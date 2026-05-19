import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "package:app/features/auth/data/auth_api.dart";
import "package:app/features/auth/presentation/widgets/auth_scaffold.dart";

class ChangePasscodePage extends StatefulWidget {
  final String citizenId;

  const ChangePasscodePage({super.key, required this.citizenId});

  @override
  State<ChangePasscodePage> createState() => _ChangePasscodePageState();
}

class _ChangePasscodePageState extends State<ChangePasscodePage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPinController = TextEditingController();
  final _newPinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authApi = const AuthApi();

  bool _submitting = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _currentPinController.dispose();
    _newPinController.dispose();
    _confirmPinController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);

    try {
      final result = await _authApi.changePin(
        citizenId: widget.citizenId,
        currentPin: _currentPinController.text,
        newPin: _newPinController.text,
        password: _passwordController.text,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result["message"]?.toString() ?? "Đổi passcode thành công")),
      );
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString().replaceFirst("Exception: ", ""))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: "Đổi passcode",
      subtitle: "Passcode dùng để khôi phục mật khẩu. Xác thực bằng mật khẩu đăng nhập.",
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildPinField(
              controller: _currentPinController,
              hint: "Passcode hiện tại",
              validator: (v) => (v ?? "").length < 4 ? "Passcode ít nhất 4 ký tự" : null,
            ),
            const SizedBox(height: 16),
            _buildPinField(
              controller: _newPinController,
              hint: "Passcode mới",
              validator: (v) => (v ?? "").length < 4 ? "Passcode ít nhất 4 ký tự" : null,
            ),
            const SizedBox(height: 16),
            _buildPinField(
              controller: _confirmPinController,
              hint: "Xác nhận passcode mới",
              validator: (v) {
                if (v != _newPinController.text) return "Passcode xác nhận không khớp";
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              validator: (v) => (v ?? "").isEmpty ? "Vui lòng nhập mật khẩu đăng nhập" : null,
              decoration: InputDecoration(
                hintText: "Mật khẩu đăng nhập (xác thực)",
                prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFA0A0A0)),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFFA0A0A0),
                  ),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
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
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFD40013),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  _submitting ? "Đang xử lý..." : "XÁC NHẬN",
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPinField({
    required TextEditingController controller,
    required String hint,
    required String? Function(String?) validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: true,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: const Icon(Icons.dialpad, color: Color(0xFFA0A0A0)),
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
    );
  }
}
