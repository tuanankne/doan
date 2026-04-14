import "package:flutter/material.dart";

import "../../data/auth_api.dart";
import "../widgets/auth_scaffold.dart";

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _citizenController = TextEditingController();
  final _pinController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _authApi = const AuthApi();

  bool _submitting = false;

  @override
  void dispose() {
    _citizenController.dispose();
    _pinController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final result = await _authApi.forgotPassword(
        citizenId: _citizenController.text.trim(),
        pin: _pinController.text,
        newPassword: _newPasswordController.text,
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result["message"]?.toString() ?? "Đặt lại mật khẩu thành công")),
      );
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString().replaceFirst("Exception: ", ""))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: "Quên mật khẩu",
      subtitle: "Nhập CCCD + PIN để đặt mật khẩu mới",
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _citizenController,
              decoration: const InputDecoration(labelText: "CCCD"),
              validator: (value) {
                if ((value ?? "").trim().isEmpty) {
                  return "Vui lòng nhập CCCD";
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _pinController,
              decoration: const InputDecoration(labelText: "Mã PIN"),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 4) {
                  return "Mã PIN ít nhất 4 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _newPasswordController,
              decoration: const InputDecoration(labelText: "Mật khẩu mới"),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 6) {
                  return "Mật khẩu ít nhất 6 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? "Đang xử lý..." : "Đặt lại mật khẩu"),
            ),
          ],
        ),
      ),
    );
  }
}
