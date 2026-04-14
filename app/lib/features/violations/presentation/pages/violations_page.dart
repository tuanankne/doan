import 'dart:async';

import 'package:flutter/material.dart';
import 'package:app/features/violations/data/violations_api.dart';

class ViolationsPage extends StatefulWidget {
  final String? citizenId;
  final String? fullName;

  const ViolationsPage({
    super.key,
    this.citizenId,
    this.fullName,
  });

  @override
  State<ViolationsPage> createState() => _ViolationsPageState();
}

class _ViolationsPageState extends State<ViolationsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late Future<List<ViolationRecord>> _violationsFuture;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _violationsFuture = ViolationsApi.getViolations();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _isPaid(String? status) {
    final value = (status ?? '').toLowerCase();
    return value.contains('paid') ||
        value.contains('đã thanh toán') ||
        value.contains('da thanh toan') ||
        value.contains('completed') ||
        value.contains('hoan thanh') ||
        value.contains('xong') ||
        value.contains('đã xử lý') ||
        value.contains('da xu ly') ||
        value.contains('done');
  }

  bool _isPending(String? status) {
    if (_isPaid(status)) {
      return false;
    }
    final value = (status ?? '').toLowerCase();
    return value.contains('pending') ||
        value.contains('chờ') ||
        value.contains('cho') ||
        value.contains('unpaid') ||
        value.contains('chưa') ||
        value.isEmpty;
  }

  String _formatMoney(int amount) {
    return '${amount.toString().replaceAllMapped(
      RegExp(r"(\d)(?=(\d{3})+(?!\d))"),
      (match) => '${match[1]}.',
    )}đ';
  }

  String _formatDetectedTime(String? rawValue) {
    final text = (rawValue ?? '').trim();
    if (text.isEmpty) {
      return 'N/A';
    }

    final parsed = DateTime.tryParse(text);
    if (parsed == null) {
      return text;
    }

    String pad(int value) => value.toString().padLeft(2, '0');
    return '${pad(parsed.hour)}:${pad(parsed.minute)} ${pad(parsed.day)}/${pad(parsed.month)}/${parsed.year}';
  }

  String _formatPaymentState(ViolationRecord record) {
    final state = (record.paymentStatus ?? record.status ?? '').toLowerCase();
    if (state.contains('paid') ||
        state.contains('đã thanh toán') ||
        state.contains('đã xử lý') ||
        state.contains('done')) {
      return 'Đã thanh toán';
    }
    return 'Chờ thanh toán';
  }

  void _openViolationDetail(ViolationRecord record) {
    final isPaid = _isPaid(record.paymentStatus ?? record.status);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.88,
          minChildSize: 0.6,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFFF6F6F6),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD8D8D8),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      record.detectedLicensePlate.isEmpty ? 'Không đọc được biển số' : record.detectedLicensePlate,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF222222),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: isPaid ? const Color(0xFFE8F5E9) : const Color(0xFFFFF2D7),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          _formatPaymentState(record),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isPaid ? const Color(0xFF2E7D32) : const Color(0xFFD40013),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _DetailCard(
                      title: 'Ảnh chụp vi phạm',
                      children: [
                        _ViolationImage(url: record.evidenceImageUrl),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _DetailCard(
                      title: 'Thông tin vi phạm',
                      children: [
                        _DetailRow(label: 'Lỗi vi phạm', value: record.violationType),
                        _DetailRow(label: 'Mã lỗi', value: record.violationCode ?? 'N/A'),
                        _DetailRow(label: 'Thời gian', value: _formatDetectedTime(record.detectedAt)),
                        _DetailRow(label: 'Mức phạt', value: _formatMoney(record.fineAmountSnapshot)),
                        _DetailRow(label: 'Biển số', value: record.detectedLicensePlate.isEmpty ? 'N/A' : record.detectedLicensePlate),
                        _DetailRow(label: 'Loại xe', value: record.vehicleType ?? 'N/A'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _DetailCard(
                      title: 'Thông tin chủ xe',
                      children: [
                        _DetailRow(label: 'Chủ xe', value: record.ownerFullName ?? 'N/A'),
                        _DetailRow(label: 'CCCD', value: record.ownerCitizenId ?? 'N/A'),
                        _DetailRow(label: 'Số điện thoại', value: record.ownerPhoneNumber ?? 'N/A'),
                        _DetailRow(label: 'Địa chỉ', value: record.ownerAddress ?? 'N/A'),
                      ],
                    ),
                    if (!isPaid) ...[
                      const SizedBox(height: 12),
                      _DetailCard(
                        title: 'Thanh toán PayPal',
                        children: [
                          const Text(
                            'Quét QR PayPal để thanh toán khoản phạt này.',
                            style: TextStyle(color: Color(0xFF666666), fontSize: 13),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 48,
                            child: FilledButton.icon(
                              onPressed: () => _showPaypalQrDialog(record),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFD40013),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              icon: const Icon(Icons.qr_code_2),
                              label: const Text('Thanh toán PayPal'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showPaypalQrDialog(ViolationRecord record) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return _PaypalQrDialog(
          record: record,
          onPaymentSuccess: () {
            Navigator.of(dialogContext).pop();
            _refreshViolations();
          },
        );
      },
    );
  }

  void _refreshViolations() {
    setState(() {
      _violationsFuture = ViolationsApi.getViolations();
    });
  }

  Future<void> _refresh() async {
    setState(() {
      _violationsFuture = ViolationsApi.getViolations();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F6F6),
      appBar: AppBar(
        title: const Text('Danh sách vi phạm'),
        centerTitle: true,
        backgroundColor: const Color(0xFFD40013),
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFFFF2D7),
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'Chờ thanh toán'),
            Tab(text: 'Đã thanh toán'),
          ],
        ),
      ),
      body: FutureBuilder<List<ViolationRecord>>(
        future: _violationsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                    const SizedBox(height: 12),
                    Text(
                      'Lỗi: ${snapshot.error}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _refresh,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFD40013),
                      ),
                      child: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            );
          }

          final violations = snapshot.data ?? [];
          final pendingViolations = violations.where((item) {
            final status = item.paymentStatus ?? item.status;
            return _isPending(status);
          }).toList();
          final paidViolations = violations.where((item) {
            final status = item.paymentStatus ?? item.status;
            return _isPaid(status);
          }).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildViolationList(
                items: pendingViolations,
                emptyMessage: 'Bạn không có vi phạm nào đang chờ thanh toán.',
              ),
              _buildViolationList(
                items: paidViolations,
                emptyMessage: 'Bạn chưa có vi phạm nào đã thanh toán.',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildViolationList({
    required List<ViolationRecord> items,
    required String emptyMessage,
  }) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: items.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 120),
                const Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    emptyMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, color: Color(0xFF666666)),
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final item = items[index];
                return _ViolationCard(
                  record: item,
                  onTap: () => _openViolationDetail(item),
                  formatMoney: _formatMoney,
                  formatDetectedTime: _formatDetectedTime,
                  paymentStateLabel: _formatPaymentState(item),
                );
              },
            ),
    );
  }
}

class _ViolationCard extends StatelessWidget {
  final ViolationRecord record;
  final VoidCallback onTap;
  final String Function(int amount) formatMoney;
  final String Function(String? rawValue) formatDetectedTime;
  final String paymentStateLabel;

  const _ViolationCard({
    required this.record,
    required this.onTap,
    required this.formatMoney,
    required this.formatDetectedTime,
    required this.paymentStateLabel,
  });

  @override
  Widget build(BuildContext context) {
    final paymentState = record.paymentStatus ?? record.status;
    final isPaid = (paymentState ?? '').toLowerCase().contains('paid') ||
      (paymentState ?? '').toLowerCase().contains('đã thanh toán') ||
      (paymentState ?? '').toLowerCase().contains('đã xử lý') ||
      (paymentState ?? '').toLowerCase().contains('done');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            record.detectedLicensePlate.isEmpty ? 'Không đọc được biển số' : record.detectedLicensePlate,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF222222),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            record.vehicleType ?? 'Không xác định',
                            style: const TextStyle(color: Color(0xFF666666)),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isPaid ? const Color(0xFFE8F5E9) : const Color(0xFFFFF2D7),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        paymentStateLabel,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: isPaid ? const Color(0xFF2E7D32) : const Color(0xFFD40013),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _CompactRow(label: 'Lỗi vi phạm', value: record.violationType),
                _CompactRow(label: 'Chủ xe', value: record.ownerFullName ?? 'N/A'),
                _CompactRow(label: 'Thời gian', value: formatDetectedTime(record.detectedAt)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CompactRow extends StatelessWidget {
  final String label;
  final String value;

  const _CompactRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF666666),
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF222222),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _DetailCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF222222),
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 122,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF666666),
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF222222),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ViolationImage extends StatelessWidget {
  final String url;

  const _ViolationImage({required this.url});

  @override
  Widget build(BuildContext context) {
    final imageUrl = url.trim();

    if (imageUrl.isEmpty) {
      return Container(
        height: 180,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F1F1),
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.center,
        child: const Text(
          'Không có ảnh chụp vi phạm',
          style: TextStyle(color: Color(0xFF666666)),
        ),
      );
    }

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => _FullScreenImagePage(imageUrl: imageUrl),
          ),
        );
      },
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFFF1F1F1),
                    alignment: Alignment.center,
                    child: const Text(
                      'Không tải được ảnh chụp vi phạm',
                      style: TextStyle(color: Color(0xFF666666)),
                    ),
                  );
                },
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) {
                    return child;
                  }
                  return Container(
                    color: const Color(0xFFF1F1F1),
                    alignment: Alignment.center,
                    child: const CircularProgressIndicator(),
                  );
                },
              ),
            ),
          ),
          Positioned(
            right: 12,
            bottom: 12,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.45),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.open_in_full,
                color: Colors.white,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FullScreenImagePage extends StatelessWidget {
  final String imageUrl;

  const _FullScreenImagePage({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 1.0,
          maxScale: 4.0,
          child: Image.network(
            imageUrl,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              return const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Không tải được ảnh',
                  style: TextStyle(color: Colors.white70),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _PaypalQrDialog extends StatefulWidget {
  final ViolationRecord record;
  final VoidCallback onPaymentSuccess;

  const _PaypalQrDialog({
    required this.record,
    required this.onPaymentSuccess,
  });

  @override
  State<_PaypalQrDialog> createState() => _PaypalQrDialogState();
}

class _PaypalQrDialogState extends State<_PaypalQrDialog> {
  late int _remainingSeconds;
  late Future<PaypalPaymentQrResponse> _paymentFuture;
  Timer? _countdownTimer;
  bool _paymentSuccess = false;
  bool _checkingPayment = false;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = 600; // 10 phút
    _paymentFuture = ViolationsApi.createPaypalPaymentQr(widget.record.id);
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      setState(() {
        if (_remainingSeconds > 0) {
          _remainingSeconds--;
        } else {
          timer.cancel();
          _showExpiredMessage();
        }
      });
    });
  }

  Future<void> _checkPaymentOnce() async {
    if (_checkingPayment || _paymentSuccess) {
      return;
    }

    setState(() {
      _checkingPayment = true;
    });

    try {
      final violations = await ViolationsApi.getViolations();
      final updated = violations.firstWhere(
        (v) => v.id == widget.record.id,
        orElse: () => widget.record,
      );

      final state = (updated.paymentStatus ?? updated.status ?? '').toLowerCase();
      final isDone = state.contains('done') ||
          state.contains('paid') ||
          state.contains('completed') ||
          state.contains('đã thanh toán') ||
          state.contains('da thanh toan');

      if (isDone && mounted) {
        _countdownTimer?.cancel();
        setState(() {
          _paymentSuccess = true;
          _checkingPayment = false;
        });

        await Future.delayed(const Duration(seconds: 1));
        if (mounted) {
          Navigator.of(context).pop();
          widget.onPaymentSuccess();
        }
        return;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Chưa ghi nhận thanh toán. Vui lòng thử lại sau khi hoàn tất trên PayPal.'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không kiểm tra được trạng thái thanh toán. Vui lòng thử lại.'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _checkingPayment = false;
        });
      }
    }
  }

  void _showExpiredMessage() {
    if (mounted) {
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('QR hết hạn'),
          content: const Text('Thời hạn của QR code đã hết (10 phút). Vui lòng quét lại.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop();
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '$minutes:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_paymentSuccess) {
      return Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.check_circle,
                color: Colors.green,
                size: 64,
              ),
              const SizedBox(height: 16),
              const Text(
                'Thanh toán thành công!',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Vi phạm ${widget.record.detectedLicensePlate} đã được thanh toán',
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF666666),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.all(16),
      child: FutureBuilder<PaypalPaymentQrResponse>(
        future: _paymentFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const SizedBox(
              height: 320,
              child: Center(child: CircularProgressIndicator()),
            );
          }

          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(
                    'Lỗi: ${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD40013),
                    ),
                    child: const Text('Đóng'),
                  ),
                ],
              ),
            );
          }

          final payment = snapshot.data;
          final qrUrl = (payment?.qrCodeUrl ?? payment?.payUrl ?? '').trim();

          return SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'QR thanh toán PayPal',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.record.detectedLicensePlate,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${_formatMoney(widget.record.fineAmountSnapshot)} • ${payment?.orderInfo ?? widget.record.violationType}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFF666666), fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'QR hết hạn trong ${_formatTime(_remainingSeconds)}',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _remainingSeconds < 60 ? Colors.red : const Color(0xFF999999),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (qrUrl.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        qrUrl,
                        width: 240,
                        height: 240,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: 240,
                            height: 240,
                            color: const Color(0xFFF1F1F1),
                            alignment: Alignment.center,
                            child: const Text('Không tải được QR'),
                          );
                        },
                      ),
                    )
                  else
                    Container(
                      width: 240,
                      height: 240,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F1F1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Text('PayPal không trả về QR'),
                    ),
                  const SizedBox(height: 16),
                  Text(
                    payment?.message ?? 'Tạo QR thành công',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFF666666), fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Quét QR để thanh toán, sau đó bấm "Tôi đã thanh toán" để cập nhật ngay.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF999999),
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _checkingPayment ? null : _checkPaymentOnce,
                      icon: _checkingPayment
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.check_circle_outline),
                      label: Text(_checkingPayment ? 'Đang kiểm tra...' : 'Tôi đã thanh toán'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD40013),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Đóng'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _formatMoney(int amount) {
    return '${(amount / 1000).toStringAsFixed(0)} K';
  }
}
