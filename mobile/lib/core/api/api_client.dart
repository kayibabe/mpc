import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  // Set at build time: flutter run --dart-define=API_BASE_URL=https://api.zcpc.mw/api/v1
  static const String _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1', // Android emulator localhost
  );
  static const _storage = FlutterSecureStorage();

  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            final refresh = await _storage.read(key: 'refresh_token');
            if (refresh != null) {
              try {
                final res = await Dio().post(
                  '${ApiClient._baseUrl}/auth/refresh',
                  data: {'refresh_token': refresh},
                );
                await _storage.write(key: 'access_token', value: res.data['access_token']);
                await _storage.write(key: 'refresh_token', value: res.data['refresh_token']);
                final opts = error.requestOptions;
                opts.headers['Authorization'] = 'Bearer ${res.data['access_token']}';
                final response = await _dio.fetch(opts);
                return handler.resolve(response);
              } catch (_) {
                await _storage.deleteAll();
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  Dio get dio => _dio;
}

final apiClient = ApiClient();
