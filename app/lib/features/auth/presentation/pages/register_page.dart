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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // CCCD Field
            TextFormField(
              controller: _citizenController,
              decoration: InputDecoration(
                hintText: "Nhập CCCD",
                prefixIcon: const Icon(Icons.badge, color: Color(0xFFA0A0A0)),
                filled: true,
                fillColor: const Color(0xFFF8F8F8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFD40013), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              validator: (value) {
                if ((value ?? "").trim().isEmpty) {
                  return "Vui lòng nhập CCCD";
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            
            // Password Field
            TextFormField(
              controller: _passwordController,
              decoration: InputDecoration(
                hintText: "Nhập mật khẩu",
                prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFA0A0A0)),
                filled: true,
                fillColor: const Color(0xFFF8F8F8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFD40013), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 6) {
                  return "Mật khẩu ít nhất 6 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            
            // Confirm Password Field
            TextFormField(
              controller: _confirmPasswordController,
              decoration: InputDecoration(
                hintText: "Xác nhận mật khẩu",
                prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFA0A0A0)),
                filled: true,
                fillColor: const Color(0xFFF8F8F8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFD40013), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              obscureText: true,
              validator: (value) {
                if (value != _passwordController.text) {
                  return "Mật khẩu xác nhận không khớp";
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            
            // PIN Field
            TextFormField(
              controller: _pinController,
              decoration: InputDecoration(
                hintText: "Mã PIN reset mật khẩu",
                prefixIcon: const Icon(Icons.key, color: Color(0xFFA0A0A0)),
                filled: true,
                fillColor: const Color(0xFFF8F8F8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFD40013), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              obscureText: true,
              validator: (value) {
                if ((value ?? "").length < 4) {
                  return "Mã PIN ít nhất 4 ký tự";
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            
            // Register Button
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFD40013),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _submitting ? "Đang xử lý..." : "ĐĂNG KÝ",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
