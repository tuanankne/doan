import "package:flutter/material.dart";

import "../features/auth/presentation/pages/login_page.dart";

class TrafficAuthApp extends StatelessWidget {
  const TrafficAuthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Traffic Citizen Auth",
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1F7A32)),
        useMaterial3: true,
      ),
      home: const LoginPage(),
    );
  }
}
