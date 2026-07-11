import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'core/auth/auth_service.dart';
import 'features/opd/login_screen.dart';
import 'features/opd/home_screen.dart';
import 'features/opd/opd_screen.dart';
import 'features/billing/billing_screen.dart';
import 'features/lab/lab_screen.dart';
import 'features/pharmacy/pharmacy_screen.dart';
import 'features/ipd/ipd_screen.dart';
import 'features/nursing/nursing_screen.dart';

final _router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) async {
    final loggedIn = await authService.isLoggedIn();
    if (!loggedIn && state.matchedLocation != '/login') return '/login';
    if (loggedIn && state.matchedLocation == '/login') return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/opd', builder: (_, __) => const OpdScreen()),
    GoRoute(path: '/billing', builder: (_, __) => const BillingScreen()),
    GoRoute(path: '/lab', builder: (_, __) => const LabScreen()),
    GoRoute(path: '/pharmacy', builder: (_, __) => const PharmacyScreen()),
    GoRoute(path: '/ipd', builder: (_, __) => const IpdScreen()),
    GoRoute(path: '/nursing', builder: (_, __) => const NursingScreen()),
  ],
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MPCApp());
}

class MPCApp extends StatelessWidget {
  const MPCApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'MPC',
      routerConfig: _router,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1D4ED8),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E40AF),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      debugShowCheckedModeBanner: false,
    );
  }
}
