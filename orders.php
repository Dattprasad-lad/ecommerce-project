<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$request_method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : null;

// Read raw input ONCE (php://input can only be read once in PHP)
$rawInput = file_get_contents('php://input');
$input    = json_decode($rawInput, true) ?? [];

// Resolve token: Authorization header -> GET _token -> body _token
$token = getBearerToken();
if (empty($token) && !empty($_GET['_token']))   $token = $_GET['_token'];
if (empty($token) && !empty($input['_token']))  $token = $input['_token'];

// Verify user is logged in
$isAuthenticated = false;
if (!empty($_SESSION['user_id'])) {
    $isAuthenticated = true;
} elseif (!empty($token)) {
    $chk = $conn->prepare("SELECT id FROM users WHERE auth_token = ?");
    $chk->bind_param('s', $token);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) $isAuthenticated = true;
    $chk->close();
}

if (!$isAuthenticated) {
    sendResponse(false, 'Unauthorized - Please login first');
}

// Helper: resolve user_id from session or token
function resolveUserId($conn, $token) {
    if (!empty($_SESSION['user_id'])) return (int)$_SESSION['user_id'];
    if (!empty($token)) {
        $stmt = $conn->prepare("SELECT id FROM users WHERE auth_token = ?");
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();
        if ($row = $result->fetch_assoc()) return (int)$row['id'];
    }
    return null;
}

// Route requests
try {
    if ($request_method === 'POST') {
        $action = $input['action'] ?? '';
        switch ($action) {
            case 'create':         createOrder($input, $conn, $token);        break;
            case 'update_address': updateOrderAddress($input, $conn, $token); break;
            case 'cancel':         cancelOrder($input, $conn, $token);        break;
            default:               sendResponse(false, 'Invalid action');
        }
    } elseif ($request_method === 'GET') {
        switch ($action) {
            case 'get_user_orders': getUserOrders($conn, $token);  break;
            case 'get_order':       getOrderById($conn, $token);   break;
            case 'get_all_orders':
                if ($_SESSION['is_admin'] ?? false) getAllOrders($conn);
                else sendResponse(false, 'Unauthorized');
                break;
            default: getUserOrders($conn, $token);
        }
    } else {
        sendResponse(false, 'Invalid request method');
    }
} catch (Exception $e) {
    sendResponse(false, 'Error: ' . $e->getMessage());
}

function createOrder($data, $conn, $token) {
    $user_id = resolveUserId($conn, $token);
    if (!$user_id) { sendResponse(false, 'User not authenticated'); return; }
    if (empty($data['items']) || empty($data['deliveryAddress']) || !isset($data['totalAmount'])) {
        sendResponse(false, 'Missing required fields'); return;
    }

    $total_amount     = intval($data['totalAmount']);
    $delivery_address = $data['deliveryAddress'];
    $payment_method   = isset($data['paymentMethod']) ? $data['paymentMethod'] : 'Cash on Delivery';
    $items_count      = count($data['items']);

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO orders (user_id, total_amount, delivery_address, payment_method, items_count) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param('iissi', $user_id, $total_amount, $delivery_address, $payment_method, $items_count);
        if (!$stmt->execute()) throw new Exception('Failed to create order: ' . $stmt->error);
        $order_id = $conn->insert_id;
        $stmt->close();

        $stmt = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
        foreach ($data['items'] as $item) {
            $product_id = intval($item['id']);
            $quantity   = intval($item['quantity']);
            $price      = intval($item['price']);
            $stmt->bind_param('iiii', $order_id, $product_id, $quantity, $price);
            if (!$stmt->execute()) throw new Exception('Failed to add order item: ' . $stmt->error);

            $ss = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
            $ss->bind_param('ii', $quantity, $product_id);
            if (!$ss->execute()) throw new Exception('Failed to update stock: ' . $ss->error);
            $ss->close();
        }
        $stmt->close();

        $conn->commit();
        sendResponse(true, 'Order created successfully', [
            'order_id'     => $order_id,
            'total_amount' => $total_amount,
            'items_count'  => $items_count,
            'status'       => 'pending'
        ]);
    } catch (Exception $e) {
        $conn->rollback();
        sendResponse(false, $e->getMessage());
    }
}

function getUserOrders($conn, $token) {
    $user_id = resolveUserId($conn, $token);
    if (!$user_id) { sendResponse(false, 'User not authenticated'); return; }
    $stmt = $conn->prepare("SELECT id, total_amount, delivery_address, payment_method, status, items_count, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $orders = [];
    while ($row = $result->fetch_assoc()) $orders[] = $row;
    $stmt->close();
    sendResponse(true, 'Orders fetched successfully', ['orders' => $orders]);
}

function getOrderById($conn, $token) {
    if (empty($_GET['id'])) { sendResponse(false, 'Order ID is required'); return; }
    $user_id = resolveUserId($conn, $token);
    if (!$user_id) { sendResponse(false, 'User not authenticated'); return; }

    $order_id = intval($_GET['id']);
    $stmt = $conn->prepare("SELECT id, user_id, total_amount, delivery_address, status, items_count, created_at FROM orders WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $order_id, $user_id);
    $stmt->execute();
    $order_result = $stmt->get_result();
    if ($order_result->num_rows === 0) { $stmt->close(); sendResponse(false, 'Order not found'); return; }
    $order = $order_result->fetch_assoc();
    $stmt->close();

    $stmt = $conn->prepare("SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
    $stmt->bind_param('i', $order_id);
    $stmt->execute();
    $items = [];
    while ($row = $stmt->get_result()->fetch_assoc()) $items[] = $row;
    $stmt->close();
    $order['items'] = $items;
    sendResponse(true, 'Order fetched successfully', ['order' => $order]);
}

function getAllOrders($conn) {
    $result = $conn->query("SELECT o.id, o.user_id, u.name, u.email, o.total_amount, o.delivery_address, o.payment_method, o.status, o.items_count, o.created_at FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC");
    if (!$result) { sendResponse(false, 'Database error: ' . $conn->error); return; }
    $orders = [];
    while ($row = $result->fetch_assoc()) $orders[] = $row;
    sendResponse(true, 'Orders fetched successfully', ['orders' => $orders]);
}

function updateOrderAddress($data, $conn, $token) {
    $user_id = resolveUserId($conn, $token);
    if (!$user_id) { sendResponse(false, 'User not authenticated'); return; }
    if (empty($data['orderId']) || empty($data['newAddress'])) { sendResponse(false, 'Order ID and new address are required'); return; }

    $order_id = intval($data['orderId']); $new_address = $data['newAddress'];
    $stmt = $conn->prepare("SELECT status FROM orders WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $order_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) { $stmt->close(); sendResponse(false, 'Order not found'); return; }
    $order = $result->fetch_assoc(); $stmt->close();
    if (!in_array($order['status'], ['pending', 'processing'])) { sendResponse(false, 'Cannot modify address for this order status'); return; }

    $stmt = $conn->prepare("UPDATE orders SET delivery_address = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param('sii', $new_address, $order_id, $user_id);
    if ($stmt->execute()) { $stmt->close(); sendResponse(true, 'Address updated successfully'); }
    else { $stmt->close(); sendResponse(false, 'Error updating address: ' . $conn->error); }
}

function cancelOrder($data, $conn, $token) {
    $user_id = resolveUserId($conn, $token);
    if (!$user_id) { sendResponse(false, 'User not authenticated'); return; }
    if (empty($data['orderId'])) { sendResponse(false, 'Order ID is required'); return; }

    $order_id = intval($data['orderId']);
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT status FROM orders WHERE id = ? AND user_id = ?");
        $stmt->bind_param('ii', $order_id, $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) { $stmt->close(); throw new Exception('Order not found'); }
        $order = $result->fetch_assoc(); $stmt->close();

        if (in_array($order['status'], ['completed', 'shipped'])) throw new Exception('Cannot cancel ' . $order['status'] . ' order');
        if ($order['status'] === 'cancelled') throw new Exception('Order is already cancelled');

        $stmt = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
        $stmt->bind_param('i', $order_id);
        $stmt->execute();
        $items_result = $stmt->get_result();
        while ($item = $items_result->fetch_assoc()) {
            $rs = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
            $rs->bind_param('ii', $item['quantity'], $item['product_id']);
            if (!$rs->execute()) throw new Exception('Failed to restore stock: ' . $rs->error);
            $rs->close();
        }
        $stmt->close();

        $status = 'cancelled';
        $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ? AND user_id = ?");
        $stmt->bind_param('sii', $status, $order_id, $user_id);
        if (!$stmt->execute()) throw new Exception('Failed to cancel order: ' . $stmt->error);
        $stmt->close();

        $conn->commit();
        sendResponse(true, 'Order cancelled successfully');
    } catch (Exception $e) {
        $conn->rollback();
        sendResponse(false, $e->getMessage());
    }
}
?>
