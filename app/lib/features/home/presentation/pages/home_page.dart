import "package:flutter/material.dart";
import "package:app/features/auth/data/profile_api.dart";
import "package:app/features/documents/presentation/pages/driver_license_page.dart";
import "package:app/features/documents/presentation/pages/vehicle_registration_page.dart";
import "package:app/features/violations/presentation/pages/violations_page.dart";

class HomePage extends StatefulWidget {
  final String? profileId;
  final String? citizenId;
  final String? fullName;

  const HomePage({
    super.key,
    this.profileId,
    this.citizenId,
    this.fullName,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _selectedTab = 0;
  late Future<UserProfile?> _profileFuture;

  @override
  void initState() {
    super.initState();
    _profileFuture = _loadProfile();
  }

  Future<UserProfile?> _loadProfile() async {
    if (widget.profileId != null) {
      try {
        return await ProfileApi.getProfile(widget.profileId!);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F6F6),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 20),
                child: Column(
                  children: [
                    _buildQuickActions(),
                    const SizedBox(height: 12),
                    _buildFeatureGrid(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: const Color(0xFFD40013),
        foregroundColor: Colors.white,
        shape: const CircleBorder(),
        child: const Icon(Icons.add, size: 30),
      ),
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        color: Colors.white,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _BottomTabItem(
                icon: Icons.home,
                label: "Trang chủ",
                isActive: _selectedTab == 0,
                onTap: () => setState(() => _selectedTab = 0),
              ),
              _BottomTabItem(
                icon: Icons.newspaper,
                label: "Tin tức",
                isActive: _selectedTab == 1,
                onTap: () => setState(() => _selectedTab = 1),
              ),
              const SizedBox(width: 40),
              _BottomTabItem(
                icon: Icons.wallet,
                label: "Ví giấy tờ",
                isActive: _selectedTab == 3,
                onTap: () => setState(() => _selectedTab = 3),
              ),
              _BottomTabItem(
                icon: Icons.settings,
                label: "Cài đặt",
                isActive: _selectedTab == 4,
                onTap: () => setState(() => _selectedTab = 4),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
      decoration: const BoxDecoration(
        color: Color(0xFFD40013),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(18),
          bottomRight: Radius.circular(18),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFFFFE8A3),
                ),
                child: const Icon(Icons.shield, color: Color(0xFFD40013)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Text(
                    "Định danh mức 2",
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              IconButton(
                onPressed: () {},
                icon: const Icon(Icons.notifications_none, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Align(
            alignment: Alignment.center,
            child: Text(
              "Trần Tuấn Anh",
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF2D7),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: _QuickActionButton(
              icon: Icons.qr_code,
              label: "Ví QR giấy tờ",
              onTap: () {},
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _QuickActionButton(
              icon: Icons.apartment,
              label: "Chuyển vai trò tổ chức",
              onTap: () {},
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureGrid() {
    final items = [
      const _FeatureItemData(icon: Icons.list_alt, label: "Danh sách vi phạm"),
      const _FeatureItemData(icon: Icons.badge, label: "Giấy phép lái xe"),
      const _FeatureItemData(icon: Icons.directions_car, label: "Đăng kí xe"),
      const _FeatureItemData(icon: Icons.support_agent, label: "Hỗ trợ"),
    ];

    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 2.45,
      ),
      itemBuilder: (context, index) {
        final item = items[index];
        return InkWell(
          onTap: () => _handleFeatureTap(context, index),
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFE10014), Color(0xFFB7000F)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFF2D7),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(item.icon, color: const Color(0xFFD40013)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        height: 1.05,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _handleFeatureTap(BuildContext context, int index) {
    switch (index) {
      case 1: // Giấy phép lái xe
        if (widget.citizenId != null && widget.fullName != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => DriverLicensePage(
                citizenId: widget.citizenId!,
                fullName: widget.fullName!,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Không thể tải thông tin người dùng")),
          );
        }
        break;
      case 2: // Đăng kí xe
        if (widget.citizenId != null && widget.fullName != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => VehicleRegistrationPage(
                citizenId: widget.citizenId!,
                fullName: widget.fullName!,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Không thể tải thông tin người dùng")),
          );
        }
        break;
      case 0: // Danh sách vi phạm
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ViolationsPage(
              citizenId: widget.citizenId,
              fullName: widget.fullName,
            ),
          ),
        );
        break;
      case 3: // Hỗ trợ
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Tính năng sẽ sớm được phát hành")),
        );
        break;
    }
  }
}

class _FeatureItemData {
  final IconData icon;
  final String label;

  const _FeatureItemData({required this.icon, required this.label});
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Ink(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFE8A3),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: const Color(0xFFD40013)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomTabItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _BottomTabItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isActive ? const Color(0xFFD40013) : const Color(0xFF6F6F6F);

    return InkWell(
      onTap: onTap,
      child: SizedBox(
        width: 70,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
