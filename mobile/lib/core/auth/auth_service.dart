import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();

  Future<Map<String, dynamic>> login(String employeeId, String password) async {
    final res = await apiClient.dio.post('/auth/login', data: {
      'employee_id': employeeId,
      'password': password,
    });
    await _storage.write(key: 'access_token', value: res.data['access_token']);
    await _storage.write(key: 'refresh_token', value: res.data['refresh_token']);
    final me = await apiClient.dio.get('/auth/me');
    return me.data;
  }

  Future<void> logout() async {
    await _storage.deleteAll();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    try {
      final res = await apiClient.dio.get('/auth/me');
      return res.data;
    } catch (_) {
      return null;
    }
  }
}

final authService = AuthService();
