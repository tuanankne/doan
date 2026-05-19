import "package:flutter/material.dart";

import "package:app/features/auth/data/profile_api.dart";
import "change_password_page.dart";
import "change_passcode_page.dart";
import "change_phone_page.dart";

class SettingsPage extends StatefulWidget {
  final String? profileId;
  final String? citizenId;
  final String? fullName;

  const SettingsPage({
    super.key,
    this.profileId,
    this.citizenId,
    this.fullName,
  });

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  UserProfile? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    if (widget.profileId == null) {
      setState(() => _loading = false);
      return;
    }

    try {
      final profile = await ProfileApi.getProfile(widget.profileId!);
      if (mounted) {
        setState(() {
          _profile = profile;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _showMissingAccountMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Vui lòng đăng nhập để sử dụng tính năng này")),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: Container(
            width: double.infinity,
            color: Colors.white,
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFD40013)))
                : ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 18, 16, 8),
                        child: Text(
                          "TÀI KHOẢN",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF9A9A9A),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      _SettingsMenuItem(
                        label: "Đổi mật khẩu",
                        icon: Icons.password,
                        onTap: () {
                          if (widget.citizenId == null) {
                            _showMissingAccountMessage();
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChangePasswordPage(
                                citizenId: widget.citizenId!,
                              ),
                            ),
                          );
                        },
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      _SettingsMenuItem(
                        label: "Đổi passcode",
                        icon: Icons.dialpad,
                        onTap: () {
                          if (widget.citizenId == null) {
                            _showMissingAccountMessage();
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChangePasscodePage(
                                citizenId: widget.citizenId!,
                              ),
                            ),
                          );
                        },
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      _SettingsMenuItem(
                        label: "Thay đổi số điện thoại",
                        icon: Icons.phone_android_outlined,
                        subtitle: _profile?.phoneNumber.isNotEmpty == true
                            ? _profile!.phoneNumber
                            : null,
                        onTap: () {
                          if (widget.profileId == null) {
                            _showMissingAccountMessage();
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChangePhonePage(
                                profileId: widget.profileId!,
                                currentPhone: _profile?.phoneNumber ?? "",
                              ),
                            ),
                          ).then((_) => _loadProfile());
                        },
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF5F0E8), Color(0xFFEDE8E0)],
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Cài đặt",
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  "Sử dụng Vân tay / Khuôn mặt để mở khóa ứng dụng nhanh chóng và bảo mật hơn",
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 100,
            height: 90,
            alignment: Alignment.center,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 64,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.verified_user,
                    size: 36,
                    color: Color(0xFF2E9E4F),
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 8,
                  child: Icon(Icons.lock, size: 16, color: Colors.red.shade400),
                ),
                Positioned(
                  bottom: 8,
                  left: 4,
                  child: Icon(Icons.check_circle, size: 14, color: Colors.green.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsMenuItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final String? subtitle;
  final VoidCallback onTap;

  const _SettingsMenuItem({
    required this.label,
    required this.icon,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF9A9A9A),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(icon, color: const Color(0xFFB0B0B0), size: 22),
          ],
        ),
      ),
    );
  }
}
