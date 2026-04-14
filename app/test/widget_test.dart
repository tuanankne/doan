import "package:app/app/app.dart";
import "package:flutter_test/flutter_test.dart";

void main() {
  testWidgets("Login page renders", (WidgetTester tester) async {
    await tester.pumpWidget(const TrafficAuthApp());

    expect(find.text("Đăng nhập"), findsWidgets);
    expect(find.text("Quên mật khẩu"), findsOneWidget);
  });
}
