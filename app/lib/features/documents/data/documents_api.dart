import 'package:app/core/network/app_api.dart';

class DriverLicense {
  final String id;
  final String citizenId;
  final String licenseNumber;
  final String licenseClass;
  final String issuedDate;
  final String expiryDate;
  final String issuingAuthority;
  final int points;
  final String status;

  DriverLicense({
    required this.id,
    required this.citizenId,
    required this.licenseNumber,
    required this.licenseClass,
    required this.issuedDate,
    required this.expiryDate,
    required this.issuingAuthority,
    required this.points,
    required this.status,
  });

  factory DriverLicense.fromJson(Map<String, dynamic> json) {
    return DriverLicense(
      id: json['id'] as String? ?? '',
      citizenId: json['citizen_id'] as String? ?? '',
      licenseNumber: json['license_number'] as String? ?? '',
      licenseClass: json['license_class'] as String? ?? '',
      issuedDate: json['issued_date'] as String? ?? '',
      expiryDate: json['expiry_date'] as String? ?? '',
      issuingAuthority: json['issuing_authority'] as String? ?? '',
      points: json['points'] as int? ?? 12,
      status: json['status'] as String? ?? 'Hoạt động',
    );
  }
}

class Vehicle {
  final String id;
  final String citizenId;
  final String licensePlate;
  final String? vehicleType;
  final String? brand;
  final String? color;
  final String? frameNumber;
  final String? engineNumber;
  final String? registrationDate;
  final String? registrationExpiryDate;
  final String? issuingAuthority;
  final String registrationStatus;

  Vehicle({
    required this.id,
    required this.citizenId,
    required this.licensePlate,
    this.vehicleType,
    this.brand,
    this.color,
    this.frameNumber,
    this.engineNumber,
    this.registrationDate,
    this.registrationExpiryDate,
    this.issuingAuthority,
    required this.registrationStatus,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] as String? ?? '',
      citizenId: json['citizen_id'] as String? ?? '',
      licensePlate: json['license_plate'] as String? ?? '',
      vehicleType: json['vehicle_type'] as String?,
      brand: json['brand'] as String?,
      color: json['color'] as String?,
      frameNumber: json['frame_number'] as String?,
      engineNumber: json['engine_number'] as String?,
      registrationDate: json['registration_date'] as String?,
      registrationExpiryDate: json['registration_expiry_date'] as String?,
      issuingAuthority: json['issuing_authority'] as String?,
      registrationStatus: json['registration_status'] as String? ?? 'Hoạt động',
    );
  }
}

class DocumentsApi {
  static Future<List<DriverLicense>> getDriverLicenses(String citizenId) async {
    try {
      final response = await AppApi.post(
        '/management/documents/driver-licenses',
        {'citizen_id': citizenId},
      );
      
      if (response['items'] is List) {
        return (response['items'] as List)
            .map((item) => DriverLicense.fromJson(item as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to fetch driver licenses: $e');
    }
  }

  static Future<List<Vehicle>> getVehicles(String citizenId) async {
    try {
      final response = await AppApi.post(
        '/management/documents/vehicles',
        {'citizen_id': citizenId},
      );
      
      if (response['items'] is List) {
        return (response['items'] as List)
            .map((item) => Vehicle.fromJson(item as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to fetch vehicles: $e');
    }
  }
}
