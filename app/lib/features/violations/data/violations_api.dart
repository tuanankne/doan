import 'package:app/core/network/app_api.dart';

class ViolationRecord {
  final String id;
  final String? vehicleId;
  final String detectedLicensePlate;
  final String? violationCode;
  final String violationType;
  final int fineAmountSnapshot;
  final String evidenceImageUrl;
  final String? evidencePlateUrl;
  final String? detectedAt;
  final String? status;
  final String? paymentStatus;
  final String? vehicleType;
  final String? ownerCitizenId;
  final String? ownerFullName;
  final String? ownerPhoneNumber;
  final String? ownerAddress;
  final String? vehicleBrand;
  final String? vehicleColor;
  final String? vehicleFrameNumber;
  final String? vehicleEngineNumber;
  final String? vehicleRegistrationDate;
  final String? vehicleRegistrationExpiryDate;
  final String? vehicleIssuingAuthority;
  final String? vehicleRegistrationStatus;

  ViolationRecord({
    required this.id,
    required this.vehicleId,
    required this.detectedLicensePlate,
    required this.violationCode,
    required this.violationType,
    required this.fineAmountSnapshot,
    required this.evidenceImageUrl,
    required this.evidencePlateUrl,
    required this.detectedAt,
    required this.status,
    required this.paymentStatus,
    required this.vehicleType,
    required this.ownerCitizenId,
    required this.ownerFullName,
    required this.ownerPhoneNumber,
    required this.ownerAddress,
    required this.vehicleBrand,
    required this.vehicleColor,
    required this.vehicleFrameNumber,
    required this.vehicleEngineNumber,
    required this.vehicleRegistrationDate,
    required this.vehicleRegistrationExpiryDate,
    required this.vehicleIssuingAuthority,
    required this.vehicleRegistrationStatus,
  });

  factory ViolationRecord.fromJson(Map<String, dynamic> json) {
    return ViolationRecord(
      id: json['id']?.toString() ?? '',
      vehicleId: json['vehicle_id']?.toString(),
      detectedLicensePlate: json['detected_license_plate']?.toString() ?? '',
      violationCode: json['violation_code']?.toString(),
      violationType: json['violation_type']?.toString() ?? '',
      fineAmountSnapshot: (json['fine_amount_snapshot'] as num?)?.toInt() ?? 0,
      evidenceImageUrl: json['evidence_image_url']?.toString() ?? '',
      evidencePlateUrl: json['evidence_plate_url']?.toString(),
      detectedAt: json['detected_at']?.toString(),
      status: json['status']?.toString(),
      paymentStatus: json['payment_status']?.toString(),
      vehicleType: json['vehicle_type']?.toString(),
      ownerCitizenId: json['owner_citizen_id']?.toString(),
      ownerFullName: json['owner_full_name']?.toString(),
      ownerPhoneNumber: json['owner_phone_number']?.toString(),
      ownerAddress: json['owner_address']?.toString(),
      vehicleBrand: json['vehicle_brand']?.toString(),
      vehicleColor: json['vehicle_color']?.toString(),
      vehicleFrameNumber: json['vehicle_frame_number']?.toString(),
      vehicleEngineNumber: json['vehicle_engine_number']?.toString(),
      vehicleRegistrationDate: json['vehicle_registration_date']?.toString(),
      vehicleRegistrationExpiryDate: json['vehicle_registration_expiry_date']?.toString(),
      vehicleIssuingAuthority: json['vehicle_issuing_authority']?.toString(),
      vehicleRegistrationStatus: json['vehicle_registration_status']?.toString(),
    );
  }
}

class PaypalPaymentQrResponse {
  final bool success;
  final String message;
  final String violationId;
  final String? orderId;
  final int? amount;
  final String? orderInfo;
  final String? payUrl;
  final String? qrCodeUrl;
  final String? deeplink;

  PaypalPaymentQrResponse({
    required this.success,
    required this.message,
    required this.violationId,
    required this.orderId,
    required this.amount,
    required this.orderInfo,
    required this.payUrl,
    required this.qrCodeUrl,
    required this.deeplink,
  });

  factory PaypalPaymentQrResponse.fromJson(Map<String, dynamic> json) {
    return PaypalPaymentQrResponse(
      success: json['success'] as bool? ?? false,
      message: json['message']?.toString() ?? '',
      violationId: json['violation_id']?.toString() ?? '',
      orderId: json['order_id']?.toString(),
      amount: (json['amount'] as num?)?.toInt(),
      orderInfo: json['order_info']?.toString(),
      payUrl: json['pay_url']?.toString(),
      qrCodeUrl: json['qr_code_url']?.toString(),
      deeplink: json['deeplink']?.toString(),
    );
  }
}

class ViolationsApi {
  static Future<List<ViolationRecord>> getViolations() async {
    final response = await AppApi.get('/violations');
    final rawItems = response['items'];

    if (rawItems is! List) {
      return [];
    }

    return rawItems
        .whereType<Map>()
        .map((item) => ViolationRecord.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  static Future<PaypalPaymentQrResponse> createPaypalPaymentQr(String violationId) async {
    final response = await AppApi.post('/violations/$violationId/paypal-qr', {});
    return PaypalPaymentQrResponse.fromJson(response);
  }
}
