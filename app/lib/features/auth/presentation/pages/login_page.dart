import "package:flutter/material.dart";

import "../../data/auth_api.dart";
import "../../../home/presentation/pages/home_page.dart";
import "../widgets/auth_scaffold.dart";
import "forgot_password_page.dart";
import "register_page.dart";

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _citizenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authApi = const AuthApi();

  bool _submitting = false;

  @override
  void dispose() {
    _citizenController.dispose();
    _passwordController.dispose();
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
      final loginResult = await _authApi.login(
        citizenId: _citizenController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) {
        return;
      }

      // Extract profile_id from login response
      final profileId = loginResult["profile_id"];
      final citizenId = _citizenController.text.trim();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(loginResult["message"]?.toString() ?? "Đăng nhập thành công")),
      );

      // For now, we'll use hardcoded full name "Trần Tuấn Anh"
      // In a real app, this would be fetched from the profile
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomePage(
            profileId: profileId as String?,
            citizenId: citizenId,
            fullName: "Trần Tuấn Anh",
          ),
        ),
      );
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
      title: "Đăng nhập",
      subtitle: "Tài khoản * (bắt buộc)",
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // CCCD/Tài khoản Field
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
            
            // Password Label
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                "Mật khẩu *",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF333333),
                ),
              ),
            ),
            
            // Password Field
            TextFormField(
              controller: _passwordController,
              decoration: InputDecoration(
                hintText: "Nhập mật khẩu",
                prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFA0A0A0)),
                suffixIcon: const Icon(Icons.visibility_off, color: Color(0xFFA0A0A0)),
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
                if ((value ?? "").isEmpty) {
                  return "Vui lòng nhập mật khẩu";
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            
            // Forgot Password Link
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _submitting
                    ? null
                    : () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ForgotPasswordPage()),
                        );
                      },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  "Quên mật khẩu?",
                  style: TextStyle(
                    color: Color(0xFFD40013),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            
            // Login Button
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
                  _submitting ? "Đang xử lý..." : "ĐĂNG NHẬP",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            
            // Divider or
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Expanded(child: Container(height: 1, color: const Color(0xFFE0E0E0))),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      "Hoặc đăng nhập bằng",
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF999999),
                      ),
                    ),
                  ),
                  Expanded(child: Container(height: 1, color: const Color(0xFFE0E0E0))),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Register Link
            Center(
              child: TextButton(
                onPressed: _submitting
                    ? null
                    : () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const RegisterPage()),
                        );
                      },
                child: const Text(
                  "Hoặc đăng ký bằng",
                  style: TextStyle(
                    color: Color(0xFF666666),
                    fontSize: 13,
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
