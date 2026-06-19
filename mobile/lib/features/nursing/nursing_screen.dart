import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

class NursingScreen extends StatefulWidget {
  const NursingScreen({super.key});

  @override
  State<NursingScreen> createState() => _NursingScreenState();
}

class _NursingScreenState extends State<NursingScreen> {
  List<Map<String, dynamic>> _vitals = [];
  bool _loading = true;
  bool _showForm = false;
  final _bpSysCtl = TextEditingController();
  final _bpDiaCtl = TextEditingController();
  final _pulseCtl = TextEditingController();
  final _tempCtl = TextEditingController();
  final _spo2Ctl = TextEditingController();
  String? _patientId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bpSysCtl.dispose();
    _bpDiaCtl.dispose();
    _pulseCtl.dispose();
    _tempCtl.dispose();
    _spo2Ctl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await apiClient.dio.get('/nursing/vitals');
      setState(() {
        _vitals = List<Map<String, dynamic>>.from(res.data as List);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_patientId == null || _patientId!.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await apiClient.dio.post('/nursing/vitals', data: {
        'patient_id': _patientId,
        if (_bpSysCtl.text.isNotEmpty) 'bp_systolic': int.tryParse(_bpSysCtl.text),
        if (_bpDiaCtl.text.isNotEmpty) 'bp_diastolic': int.tryParse(_bpDiaCtl.text),
        if (_pulseCtl.text.isNotEmpty) 'pulse': int.tryParse(_pulseCtl.text),
        if (_tempCtl.text.isNotEmpty) 'temperature': double.tryParse(_tempCtl.text),
        if (_spo2Ctl.text.isNotEmpty) 'spo2': int.tryParse(_spo2Ctl.text),
      });
      setState(() { _showForm = false; _submitting = false; });
      _load();
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Color _alertColor(Map<String, dynamic> v) {
    final bp = v['bp_systolic'] as int?;
    final temp = (v['temperature'] as num?)?.toDouble();
    final spo2 = v['spo2'] as int?;
    if (bp != null && (bp > 140 || bp < 90)) return Colors.red;
    if (temp != null && temp > 37.5) return Colors.orange;
    if (spo2 != null && spo2 < 95) return Colors.red;
    return Colors.green;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nursing Station'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          IconButton(
            icon: Icon(_showForm ? Icons.close : Icons.add),
            onPressed: () => setState(() => _showForm = !_showForm),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showForm)
            Card(
              margin: const EdgeInsets.all(12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Record Vitals', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    TextField(
                      decoration: const InputDecoration(labelText: 'Patient ID', border: OutlineInputBorder()),
                      onChanged: (v) => _patientId = v,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(child: TextField(
                          controller: _bpSysCtl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'BP Sys', border: OutlineInputBorder()),
                        )),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(
                          controller: _bpDiaCtl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'BP Dia', border: OutlineInputBorder()),
                        )),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(child: TextField(
                          controller: _pulseCtl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Pulse', border: OutlineInputBorder()),
                        )),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(
                          controller: _tempCtl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Temp (°C)', border: OutlineInputBorder()),
                        )),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(
                          controller: _spo2Ctl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'SpO₂ %', border: OutlineInputBorder()),
                        )),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Save Vitals'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _vitals.isEmpty
                    ? const Center(child: Text('No vitals recorded yet', style: TextStyle(color: Colors.grey)))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _vitals.length,
                          itemBuilder: (_, i) {
                            final v = _vitals[i];
                            final color = _alertColor(v);
                            final bp = (v['bp_systolic'] != null && v['bp_diastolic'] != null)
                                ? '${v["bp_systolic"]}/${v["bp_diastolic"]} mmHg'
                                : null;
                            return Card(
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: color.withValues(alpha: 0.1),
                                  child: Icon(Icons.monitor_heart, color: color),
                                ),
                                title: Text(
                                  [
                                    if (bp != null) bp,
                                    if (v['pulse'] != null) '${v["pulse"]} bpm',
                                    if (v['temperature'] != null) '${v["temperature"]}°C',
                                    if (v['spo2'] != null) 'SpO₂ ${v["spo2"]}%',
                                  ].join(' Â· '),
                                  style: const TextStyle(fontSize: 13),
                                ),
                                subtitle: Text(
                                  (v['recorded_at'] as String? ?? '').substring(0, 16).replaceFirst('T', ' '),
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
