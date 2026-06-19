import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

class OpdScreen extends StatefulWidget {
  const OpdScreen({super.key});

  @override
  State<OpdScreen> createState() => _OpdScreenState();
}

class _OpdScreenState extends State<OpdScreen> {
  List<Map<String, dynamic>> _encounters = [];
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
      final today = DateTime.now().toIso8601String().substring(0, 10);
      final res = await apiClient.dio.get(
        '/encounters',
        queryParameters: {'status': 'open', 'encounter_date': today},
      );
      setState(() {
        _encounters = List<Map<String, dynamic>>.from(res.data as List);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'open': return Colors.green;
      case 'closed': return Colors.grey;
      default: return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(“OPD – Today's Queue”),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 48),
                    const SizedBox(height: 8),
                    Text(_error!, textAlign: TextAlign.center),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ))
              : _encounters.isEmpty
                  ? const Center(child: Text('No encounters today', style: TextStyle(color: Colors.grey)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _encounters.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final enc = _encounters[i];
                          final status = enc['status'] as String? ?? '';
                          return Card(
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: _statusColor(status).withValues(alpha: 0.15),
                                child: Icon(Icons.person, color: _statusColor(status)),
                              ),
                              title: Text(
                                enc['chief_complaint'] as String? ?? 'No complaint recorded',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                (enc['encounter_type'] as String? ?? '').toUpperCase(),
                                style: const TextStyle(fontSize: 12),
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _statusColor(status).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(color: _statusColor(status), fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
