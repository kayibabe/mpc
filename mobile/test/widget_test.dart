import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zcpc_mobile/main.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const ZCPCApp());
    // GoRouter with async redirect means we can't pump to settled state here.
    // Just verify the widget tree initialises without exceptions.
    expect(find.byType(MaterialApp), findsNothing); // uses MaterialApp.router
    expect(find.byType(Router), findsOneWidget);
  });
}
