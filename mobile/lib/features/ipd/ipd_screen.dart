import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

class IpdScreen extends StatefulWidget {
  const IpdScreen({super.key});

  @override
  State<IpdScreen> createState() => _IpdScreenState();
}

class _IpdScreenState extends State<IpdScreen> {
  List<Map<String, dynamic>> _wards = [];
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
      final res = await apiClient.dio.get('/admissions/wards');
      setState(() {
        _wards = List<Map<String, dynamic>>.from(res.data as List);
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
        title: const Text('IPD â€” Ward View'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _wards.isEmpty
                  ? const Center(child: Text('No wards configured', style: TextStyle(color: Colors.grey)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _wards.length,
                        itemBuilder: (_, i) {
                          final ward = _wards[i];
                          final beds = (ward['beds'] as List?) ?? [];
                          final occupied = beds.where((b) => (b as Map)['status'] == 'occupied').length;
                          final total = beds.length;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ListTile(
                                  title: Text(ward['name'] as String? ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.bold)),
                                  subtitle: Text((ward['ward_type'] as String? ?? '').toUpperCase()),
                                  trailing: Text(
                                    '$occupied/$total',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: occupied > total * 0.8 ? Colors.red : Colors.green,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                                  child: Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: beds.map((b) {
                                      final bed = b as Map<String, dynamic>;
                                      final isOccupied = bed['status'] == 'occupied';
                                      return Container(
                                        width: 36,
                                        height: 36,
                                        decoration: BoxDecoration(
                                          color: isOccupied
                                              ? Colors.red.withValues(alpha: 0.15)
                                              : Colors.green.withValues(alpha: 0.15),
                                          border: Border.all(
                                            color: isOccupied ? Colors.red : Colors.green,
                                          ),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Center(
                                          child: Text(
                                            bed['bed_number'] as String? ?? '',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: isOccupied ? Colors.red : Colors.green,
                                            ),
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
