import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

class LabScreen extends StatefulWidget {
  const LabScreen({super.key});

  @override
  State<LabScreen> createState() => _LabScreenState();
}

class _LabScreenState extends State<LabScreen> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = 'pending';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await apiClient.dio.get(
        '/lab/orders',
        queryParameters: {'status': _statusFilter},
      );
      setState(() {
        _orders = List<Map<String, dynamic>>.from(res.data as List);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending': return Colors.orange;
      case 'sample_collected': return Colors.blue;
      case 'processing': return Colors.purple;
      case 'resulted': return Colors.green;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Laboratory'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: ['pending', 'sample_collected', 'processing', 'resulted'].map((s) {
                final selected = s == _statusFilter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(s.replaceAll('_', ' ')),
                    selected: selected,
                    onSelected: (_) { setState(() => _statusFilter = s); _load(); },
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : _orders.isEmpty
                        ? const Center(child: Text('No orders', style: TextStyle(color: Colors.grey)))
                        : ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: _orders.length,
                            itemBuilder: (_, i) {
                              final order = _orders[i];
                              final status = order['status'] as String? ?? '';
                              final items = (order['items'] as List?)?.length ?? 0;
                              return Card(
                                child: ListTile(
                                  leading: Icon(Icons.science, color: _statusColor(status)),
                                  title: Text('$items test${items != 1 ? "s" : ""}'),
                                  subtitle: Text(
                                    (order['created_at'] as String? ?? '').substring(0, 10),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  trailing: Text(
                                    status.replaceAll('_', ' '),
                                    style: TextStyle(color: _statusColor(status), fontSize: 12),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
