import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "package:app/features/auth/data/profile_api.dart";
import "package:app/features/auth/presentation/widgets/auth_scaffold.dart";

class ChangePhonePage extends StatefulWidget {
  final String profileId;
  final String currentPhone;

  const ChangePhonePage({
    super.key,
    required this.profileId,
    required this.currentPhone,
  });

  @override
  State<ChangePhonePage> createState() => _ChangePhonePageState();
}

class _ChangePhonePageState extends State<ChangePhonePage> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _phoneController.text = widget.currentPhone;
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);

    try {
      await ProfileApi.updatePhoneNumber(
        profileId: widget.profileId,
        phoneNumber: _phoneController.text.trim(),
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Cập nhật số điện thoại thành công")),
      );
      Navigator.pop(context, true);
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
      title: "Thay đổi số điện thoại",
      subtitle: "Cập nhật số điện thoại liên kết với tài khoản của bạn",
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.currentPhone.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F8F8),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.phone_outlined, color: Color(0xFF9A9A9A), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Số hiện tại: ${widget.currentPhone}",
                        style: const TextStyle(fontSize: 14, color: Color(0xFF666666)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                hintText: "Nhập số điện thoại mới",
                prefixIcon: const Icon(Icons.phone_android_outlined, color: Color(0xFFA0A0A0)),
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
                final phone = (value ?? "").trim();
                if (phone.length < 9 || phone.length > 11) {
                  return "Số điện thoại không hợp lệ (9-11 chữ số)";
                }
                return null;
              },
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
                  _submitting ? "Đang xử lý..." : "LƯU THAY ĐỔI",
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
