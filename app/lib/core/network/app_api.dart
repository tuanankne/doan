import "dart:convert";

import "package:http/http.dart" as http;

class AppApi {
  AppApi._();

  // Android emulator can reach localhost of host machine via 10.0.2.2.
  static const String _defaultBaseUrl = "http://10.0.2.2:8000/api/v1";
  static const String baseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: _defaultBaseUrl,
  );

  static Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic> payload,
  ) async {
    final response = await http.post(
      Uri.parse("$baseUrl$endpoint"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(payload),
    );

    Map<String, dynamic> data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      data = {};
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = data["detail"]?.toString() ?? "Request failed";
      throw Exception(message);
    }

    return data;
  }
}
