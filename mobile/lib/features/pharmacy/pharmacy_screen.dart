import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

class PharmacyScreen extends StatefulWidget {
  const PharmacyScreen({super.key});

  @override
  State<PharmacyScreen> createState() => _PharmacyScreenState();
}

class _PharmacyScreenState extends State<PharmacyScreen> {
  List<Map<String, dynamic>> _prescriptions = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await apiClient.dio.get(
        '/pharmacy/prescriptions',
        queryParameters: {'status': 'pending'},
      );
      setState(() {
        _prescriptions = List<Map<String, dynamic>>.from(res.data as List);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pharmacy'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _prescriptions.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle, color: Colors.green, size: 48),
                          SizedBox(height: 8),
                          Text('No pending prescriptions', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _prescriptions.length,
                        itemBuilder: (_, i) {
                          final rx = _prescriptions[i];
                          final items = (rx['items'] as List?)?.length ?? 0;
                          return Card(
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: Color(0xFFFEE2E2),
                                child: Icon(Icons.local_pharmacy, color: Color(0xFFDC2626)),
                              ),
                              title: Text('$items item${items != 1 ? "s" : ""}'),
                              subtitle: Text(
                                (rx['created_at'] as String? ?? '').substring(0, 16).replaceFirst('T', ' '),
                                style: const TextStyle(fontSize: 12),
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.orange.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Text('pending', style: TextStyle(color: Colors.orange, fontSize: 12)),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
