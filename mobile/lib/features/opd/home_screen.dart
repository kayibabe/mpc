import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    authService.getCurrentUser().then((u) => setState(() => _user = u));
  }

  Future<void> _logout() async {
    await authService.logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final role = _user?['role'] ?? '';

    final modules = <Map<String, dynamic>>[
      if (['receptionist', 'admin'].contains(role))
        {'label': 'Reception', 'icon': Icons.people, 'color': const Color(0xFF2563EB), 'route': '/reception'},
      if (['doctor', 'nurse', 'admin'].contains(role))
        {'label': 'OPD', 'icon': Icons.medical_services, 'color': const Color(0xFF16A34A), 'route': '/opd'},
      if (['doctor', 'nurse', 'admin'].contains(role))
        {'label': 'IPD / Ward', 'icon': Icons.bed, 'color': const Color(0xFF7C3AED), 'route': '/ipd'},
      if (['nurse', 'admin'].contains(role))
        {'label': 'Nursing', 'icon': Icons.monitor_heart, 'color': const Color(0xFFDB2777), 'route': '/nursing'},
      if (['pharmacist', 'admin'].contains(role))
        {'label': 'Pharmacy', 'icon': Icons.local_pharmacy, 'color': const Color(0xFFDC2626), 'route': '/pharmacy'},
      if (['lab_tech', 'doctor', 'admin'].contains(role))
        {'label': 'Lab', 'icon': Icons.science, 'color': const Color(0xFFD97706), 'route': '/lab'},
      if (['billing_clerk', 'admin'].contains(role))
        {'label': 'Billing', 'icon': Icons.receipt_long, 'color': const Color(0xFF4F46E5), 'route': '/billing'},
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('ZCPC'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Good day, ${(_user?['full_name'] ?? '').split(' ').first}',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            Text(role.replaceAll('_', ' '), style: const TextStyle(color: Colors.grey, fontSize: 13)),
            const SizedBox(height: 20),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.3,
                ),
                itemCount: modules.length,
                itemBuilder: (_, i) {
                  final m = modules[i];
                  return Card(
                    color: m['color'] as Color,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => context.go(m['route'] as String),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(m['icon'] as IconData, color: Colors.white, size: 32),
                            const SizedBox(height: 8),
                            Text(m['label'] as String,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
