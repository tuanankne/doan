import "package:flutter/material.dart";

import "../../data/auth_api.dart";
import "../widgets/auth_scaffold.dart";

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _citizenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _pinController = TextEditingController();
  final _authApi = const AuthApi();

  bool _submitting = false;

  @override
  void dispose() {
    _citizenController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _pinController.dispose();
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
      final result = await _authApi.register(
        citizenId: _citizenController.text.trim(),
        password: _passwordController.text,
        confirmPassword: _confirmPasswordController.text,
        pin: _pinController.text,
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result["message"]?.toString() ?? "Đăng ký thành công")),
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
      title: "Đăng ký tài khoản",
      subtitle: "CCCD phải tồn tại trong hồ sơ dân cư",
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
              controller: _passwordController,
              decoration: const InputDecoration(labelText: "Mật khẩu"),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 6) {
                  return "Mật khẩu ít nhất 6 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _confirmPasswordController,
              decoration: const InputDecoration(labelText: "Xác nhận mật khẩu"),
              obscureText: true,
              validator: (value) {
                if (value != _passwordController.text) {
                  return "Mật khẩu xác nhận không khớp";
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _pinController,
              decoration: const InputDecoration(labelText: "Mã PIN reset mật khẩu"),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 4) {
                  return "Mã PIN ít nhất 4 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? "Đang xử lý..." : "Đăng ký"),
            ),
          ],
        ),
      ),
    );
  }
}
