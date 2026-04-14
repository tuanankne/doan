import 'package:flutter/material.dart';
import 'package:app/features/documents/data/documents_api.dart';

class VehicleRegistrationPage extends StatefulWidget {
  final String citizenId;
  final String fullName;

  const VehicleRegistrationPage({
    super.key,
    required this.citizenId,
    required this.fullName,
  });

  @override
  State<VehicleRegistrationPage> createState() => _VehicleRegistrationPageState();
}

class _VehicleRegistrationPageState extends State<VehicleRegistrationPage> {
  late Future<List<Vehicle>> _vehiclesFuture;

  @override
  void initState() {
    super.initState();
    _vehiclesFuture = DocumentsApi.getVehicles(widget.citizenId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFD40013),
        foregroundColor: Colors.white,
        title: const Text('Đăng kí xe'),
        elevation: 0,
      ),
      backgroundColor: const Color(0xFFF6F6F6),
      body: FutureBuilder<List<Vehicle>>(
        future: _vehiclesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text('Lỗi: ${snapshot.error}'),
                ],
              ),
            );
          }

          final vehicles = snapshot.data ?? [];
          if (vehicles.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.directions_car, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('Không có xe đăng kí'),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: vehicles.length,
            itemBuilder: (context, index) {
              final vehicle = vehicles[index];
              return _buildVehicleCard(vehicle);
            },
          );
        },
      ),
    );
  }

  Widget _buildVehicleCard(Vehicle vehicle) {
    final isExpired = vehicle.registrationExpiryDate != null &&
        vehicle.registrationExpiryDate!.compareTo(DateTime.now().toString().split(' ')[0]) < 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFE10014), Color(0xFFB7000F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with title and status badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'GIẤY ĐĂNG KÍ XE',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF2D7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  isExpired ? 'Hết hạn' : 'Đã xác minh',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isExpired ? Colors.red : const Color(0xFF333333),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(color: Colors.white.withOpacity(0.3)),
          const SizedBox(height: 12),

          // License plate (prominent)
          const Text(
            'Biển số xe',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFFFFD7D7),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF2D7),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFD40013), width: 2),
            ),
            child: Text(
              vehicle.licensePlate,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFFD40013),
                letterSpacing: 2,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Registration number and frame number
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Số giấy đăng ký',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.citizenId,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Số khung',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.frameNumber ?? 'N/A',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Registration date and expiry date
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Ngày đăng ký',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.registrationDate ?? 'N/A',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hết hạn',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.registrationExpiryDate ?? 'N/A',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isExpired ? const Color(0xFFFFD7D7) : Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Engine number
          const Text(
            'Số máy',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFFFFD7D7),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            vehicle.engineNumber ?? 'N/A',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 12),

          // Vehicle type and brand
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Loại phương tiện',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.vehicleType ?? 'N/A',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hãng xe',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.brand ?? 'N/A',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Owner and color
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Chủ xe',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.fullName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Màu sắc',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFFD7D7),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vehicle.color ?? 'N/A',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Issuing authority
          const Text(
            'Cơ quan cấp',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFFFFD7D7),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            vehicle.issuingAuthority ?? 'N/A',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
