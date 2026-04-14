import 'package:app/core/network/app_api.dart';

class UserProfile {
  final String id;
  final String fullName;
  final String citizenId;
  final String phoneNumber;
  final String? address;
  final String? dateOfBirth;

  UserProfile({
    required this.id,
    required this.fullName,
    required this.citizenId,
    required this.phoneNumber,
    this.address,
    this.dateOfBirth,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      citizenId: json['citizen_id'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      address: json['address'] as String?,
      dateOfBirth: json['date_of_birth'] as String?,
    );
  }
}

class ProfileApi {
  static Future<UserProfile> getProfile(String profileId) async {
    final response = await AppApi.get('/management/profiles/$profileId');
    
    if (response is Map<String, dynamic>) {
      return UserProfile.fromJson(response);
    }
    throw Exception('Failed to fetch profile');
  }
}
