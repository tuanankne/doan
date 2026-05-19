import "../../../core/network/app_api.dart";

class AuthApi {
  const AuthApi();

  Future<Map<String, dynamic>> login({
    required String citizenId,
    required String password,
  }) {
    return AppApi.post("/management/auth/login", {
      "citizen_id": citizenId,
      "password": password,
    });
  }

  Future<Map<String, dynamic>> register({
    required String citizenId,
    required String password,
    required String confirmPassword,
    required String pin,
  }) {
    return AppApi.post("/management/auth/register", {
      "citizen_id": citizenId,
      "password": password,
      "confirm_password": confirmPassword,
      "pin": pin,
    });
  }

  Future<Map<String, dynamic>> forgotPassword({
    required String citizenId,
    required String pin,
    required String newPassword,
  }) {
    return AppApi.post("/management/auth/forgot-password", {
      "citizen_id": citizenId,
      "pin": pin,
      "new_password": newPassword,
    });
  }

  Future<Map<String, dynamic>> changePassword({
    required String citizenId,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return AppApi.post("/management/auth/change-password", {
      "citizen_id": citizenId,
      "current_password": currentPassword,
      "new_password": newPassword,
      "confirm_password": confirmPassword,
    });
  }

  Future<Map<String, dynamic>> changePin({
    required String citizenId,
    required String currentPin,
    required String newPin,
    required String password,
  }) {
    return AppApi.post("/management/auth/change-pin", {
      "citizen_id": citizenId,
      "current_pin": currentPin,
      "new_pin": newPin,
      "password": password,
    });
  }
}
