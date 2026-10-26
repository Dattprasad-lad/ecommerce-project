<?php
require_once __DIR__ . '/db.php';

// CORS headers (must come before any output or exit)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$request_method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : null;

// ── Admin auth check ──────────────────────────────────────────
if (!($_SESSION['is_admin'] ?? false)) {
    $token = getBearerToken();
    // Fallback: check GET param (for XAMPP Apache header stripping)
    if (empty($token) && !empty($_GET['_token'])) {
        $token = $_GET['_token'];
    }
    // Fallback: check POST body _token
    if (empty($token)) {
        $bodyData = json_decode(file_get_contents('php://input'), true);
        if (!empty($bodyData['_token'])) {
            $token = $bodyData['_token'];
        }
    }
    if ($token) {
        $stmt = $conn->prepare("SELECT id, is_admin FROM users WHERE auth_token = ?");
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row || !$row['is_admin']) {
            sendResponse(false, 'Unauthorized - Admin access required');
        }
        $_SESSION['user_id']  = $row['id'];
        $_SESSION['is_admin'] = true;
    } else {
        sendResponse(false, 'Unauthorized - Admin access required');
    }
}

try {
    if ($request_method === 'GET') {
        switch ($action) {
            case 'dashboard':          getDashboardData($conn);   break;
            case 'daily_report':       getDailyReport($conn);     break;
            case 'date_range_report':  getDateRangeReport($conn); break;
            case 'product_stats':      getProductStats($conn);    break;
            case 'get_all_orders':     getAllOrdersAdmin($conn);   break;
            case 'get_all_users':      getAllUsers($conn);         break;
            default:                   getDashboardData($conn);
        }
    } elseif ($request_method === 'POST') {
        $input      = json_decode(file_get_contents('php://input'), true);
        $postAction = $input['action'] ?? '';
        switch ($postAction) {
            case 'update_order_status': updateOrderStatus($input, $conn); break;
            case 'generate_report':     generateDailyReport($conn);       break;
            case 'delete_user':         deleteUser($input, $conn);         break;
            case 'toggle_admin':        toggleAdmin($input, $conn);        break;
            case 'add_product':         addProductAdmin($input, $conn);    break;
            case 'update_product':      updateProductAdmin($input, $conn); break;
            case 'delete_product':      deleteProductAdmin($input, $conn); break;
            default: sendResponse(false, 'Invalid action');
        }
    } else {
        sendResponse(false, 'Invalid request method');
    }
} catch (Exception $e) {
    sendResponse(false, 'Error: ' . $e->getMessage());
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function getDashboardData($conn) {
    $today_sales    = $conn->query("SELECT COALESCE(SUM(total_amount),0) as t FROM orders WHERE DATE(created_at)=CURDATE() AND status='completed'")->fetch_assoc()['t'];
    $today_orders   = $conn->query("SELECT COUNT(*) as c FROM orders WHERE DATE(created_at)=CURDATE()")->fetch_assoc()['c'];
    $pending_orders = $conn->query("SELECT COUNT(*) as c FROM orders WHERE status IN('pending','processing')")->fetch_assoc()['c'];
    $total_products = $conn->query("SELECT COUNT(*) as c FROM products")->fetch_assoc()['c'];
    $total_users    = $conn->query("SELECT COUNT(*) as c FROM users WHERE is_admin=FALSE")->fetch_assoc()['c'];
    $total_revenue  = $conn->query("SELECT COALESCE(SUM(total_amount),0) as t FROM orders WHERE status='completed'")->fetch_assoc()['t'];

    $low_stock = [];
    $ls = $conn->query("SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC");
    while ($r = $ls->fetch_assoc()) $low_stock[] = $r;

    $recent_orders = [];
    $ro = $conn->query("SELECT o.id, u.name, o.total_amount, o.status, o.created_at FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 10");
    while ($r = $ro->fetch_assoc()) $recent_orders[] = $r;

    // Sales last 7 days chart data
    $chart_data = [];
    $cd = $conn->query("SELECT DATE(created_at) as d, COALESCE(SUM(CASE WHEN status='completed' THEN total_amount ELSE 0 END),0) as sales FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at) ORDER BY d ASC");
    while ($r = $cd->fetch_assoc()) $chart_data[] = $r;

    sendResponse(true, 'Dashboard data fetched', [
        'today_sales'        => $today_sales,
        'today_orders'       => $today_orders,
        'pending_orders'     => $pending_orders,
        'total_products'     => $total_products,
        'total_users'        => $total_users,
        'total_revenue'      => $total_revenue,
        'today_profit'       => floor($today_sales  * 0.30),
        'total_profit'       => floor($total_revenue * 0.30),
        'low_stock_products' => $low_stock,
        'recent_orders'      => $recent_orders,
        'chart_data'         => $chart_data,
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL ORDERS (admin with filter + search)
// ─────────────────────────────────────────────────────────────────────────────
function getAllOrdersAdmin($conn) {
    $where  = "1=1";
    $params = [];
    $types  = '';

    if (!empty($_GET['status'])) {
        $where   .= " AND o.status = ?";
        $types   .= 's';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['search'])) {
        $where   .= " AND (u.name LIKE ? OR u.email LIKE ? OR CAST(o.id AS CHAR) LIKE ?)";
        $s        = '%' . $_GET['search'] . '%';
        $types   .= 'sss';
        $params   = array_merge($params, [$s, $s, $s]);
    }

    $sql = "SELECT o.id, u.name, u.email, o.total_amount, o.delivery_address,
                   o.status, o.items_count, o.created_at
            FROM orders o JOIN users u ON o.user_id=u.id
            WHERE $where ORDER BY o.created_at DESC";

    if ($types) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();
    } else {
        $result = $conn->query($sql);
    }

    $orders = [];
    while ($r = $result->fetch_assoc()) $orders[] = $r;
    sendResponse(true, 'Orders fetched', ['orders' => $orders]);
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
function getAllUsers($conn) {
    $search = !empty($_GET['search']) ? '%' . $_GET['search'] . '%' : null;
    if ($search) {
        $stmt = $conn->prepare("SELECT id, name, email, phone, is_admin, is_verified, created_at FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC");
        $stmt->bind_param('ss', $search, $search);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();
    } else {
        $result = $conn->query("SELECT id, name, email, phone, is_admin, is_verified, created_at FROM users ORDER BY created_at DESC");
    }
    $users = [];
    while ($r = $result->fetch_assoc()) $users[] = $r;
    sendResponse(true, 'Users fetched', ['users' => $users]);
}

function deleteUser($data, $conn) {
    if (empty($data['userId'])) { sendResponse(false, 'User ID required'); return; }
    $id   = intval($data['userId']);
    $stmt = $conn->prepare("DELETE FROM users WHERE id=? AND is_admin=FALSE");
    $stmt->bind_param('i', $id);
    $stmt->execute() ? sendResponse(true, 'User deleted') : sendResponse(false, 'Error: ' . $conn->error);
    $stmt->close();
}

function toggleAdmin($data, $conn) {
    if (empty($data['userId'])) { sendResponse(false, 'User ID required'); return; }
    $id   = intval($data['userId']);
    $stmt = $conn->prepare("UPDATE users SET is_admin = NOT is_admin WHERE id=?");
    $stmt->bind_param('i', $id);
    $stmt->execute() ? sendResponse(true, 'Admin status toggled') : sendResponse(false, 'Error: ' . $conn->error);
    $stmt->close();
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER STATUS
// ─────────────────────────────────────────────────────────────────────────────
function updateOrderStatus($data, $conn) {
    if (empty($data['orderId']) || empty($data['status'])) {
        sendResponse(false, 'Order ID and status required'); return;
    }
    $valid = ['pending','processing','shipped','completed','cancelled'];
    if (!in_array($data['status'], $valid)) { sendResponse(false, 'Invalid status'); return; }

    $id     = intval($data['orderId']);
    $status = $data['status'];

    if ($status === 'cancelled') {
        $items = $conn->query("SELECT product_id, quantity FROM order_items WHERE order_id=$id");
        while ($item = $items->fetch_assoc()) {
            $conn->query("UPDATE products SET stock=stock+{$item['quantity']} WHERE id={$item['product_id']}");
        }
    }

    $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute() ? sendResponse(true, 'Order status updated') : sendResponse(false, 'Error: ' . $conn->error);
    $stmt->close();
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS CRUD (admin)
// ─────────────────────────────────────────────────────────────────────────────
function addProductAdmin($data, $conn) {
    if (empty($data['name']) || empty($data['category']) || empty($data['price'])) {
        sendResponse(false, 'name, category, price are required'); return;
    }
    $orig  = $data['original_price'] ?? $data['price'];
    $rat   = $data['rating']      ?? 4.5;
    $desc  = $data['description'] ?? '';
    $stock = $data['stock']       ?? 100;
    $img   = $data['image']       ?? '';

    $stmt = $conn->prepare("INSERT INTO products (name, category, price, original_price, rating, image, description, stock) VALUES (?,?,?,?,?,?,?,?)");
    $stmt->bind_param('ssiidssi', $data['name'], $data['category'], $data['price'], $orig, $rat, $img, $desc, $stock);
    if ($stmt->execute()) {
        $id = $conn->insert_id;
        $stmt->close();
        sendResponse(true, 'Product added', ['product_id' => $id]);
    } else {
        sendResponse(false, 'Error: ' . $conn->error);
    }
}

function updateProductAdmin($data, $conn) {
    if (empty($data['id'])) { sendResponse(false, 'Product ID required'); return; }
    $fields = ['name'=>'s','category'=>'s','price'=>'i','original_price'=>'i','rating'=>'d','description'=>'s','stock'=>'i','image'=>'s'];
    $sets=[]; $types=''; $vals=[];
    foreach ($fields as $f => $t) {
        if (isset($data[$f])) { $sets[]="$f=?"; $types.=$t; $vals[]=$data[$f]; }
    }
    if (!$sets) { sendResponse(false, 'Nothing to update'); return; }
    $types.='i'; $vals[]=intval($data['id']);
    $stmt=$conn->prepare("UPDATE products SET ".implode(',',$sets)." WHERE id=?");
    $stmt->bind_param($types,...$vals);
    $stmt->execute() ? sendResponse(true,'Product updated') : sendResponse(false,'Error: '.$conn->error);
    $stmt->close();
}

function deleteProductAdmin($data, $conn) {
    if (empty($data['id'])) { sendResponse(false, 'Product ID required'); return; }
    $id=$conn->real_escape_string(intval($data['id']));
    $conn->query("DELETE FROM order_items WHERE product_id=$id");
    $stmt=$conn->prepare("DELETE FROM products WHERE id=?");
    $stmt->bind_param('i',$id);
    $stmt->execute() ? sendResponse(true,'Product deleted') : sendResponse(false,'Error: '.$conn->error);
    $stmt->close();
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
function getDailyReport($conn) {
    $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
    $stmt = $conn->prepare("SELECT DATE(created_at) as date, COUNT(*) as total_orders,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status='completed' THEN total_amount ELSE 0 END),0) as sales,
        COALESCE(SUM(CASE WHEN status='cancelled' THEN total_amount ELSE 0 END),0) as losses
        FROM orders WHERE DATE(created_at)=? GROUP BY DATE(created_at)");
    $stmt->bind_param('s', $date);
    $stmt->execute();
    $result=$stmt->get_result(); $stmt->close();
    if ($result->num_rows===0) {
        sendResponse(true,'No data',['date'=>$date,'total_orders'=>0,'completed_orders'=>0,'cancelled_orders'=>0,'sales'=>0,'losses'=>0,'profit'=>0]);
        return;
    }
    $d=$result->fetch_assoc(); $d['profit']=floor($d['sales']*0.30);
    sendResponse(true,'Daily report fetched',$d);
}

function getDateRangeReport($conn) {
    $start = isset($_GET['start']) ? $_GET['start'] : date('Y-m-d', strtotime('-30 days'));
    $end   = isset($_GET['end'])   ? $_GET['end']   : date('Y-m-d');
    $stmt  = $conn->prepare("SELECT DATE(created_at) as date, COUNT(*) as total_orders,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status='completed' THEN total_amount ELSE 0 END),0) as sales,
        COALESCE(SUM(CASE WHEN status='cancelled' THEN total_amount ELSE 0 END),0) as losses
        FROM orders WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY DATE(created_at) DESC");
    $stmt->bind_param('ss', $start, $end);
    $stmt->execute();
    $result=$stmt->get_result(); $stmt->close();
    $reports=[]; $ts=0; $tl=0; $to=0;
    while($r=$result->fetch_assoc()) { $r['profit']=floor($r['sales']*0.30); $reports[]=$r; $ts+=$r['sales']; $tl+=$r['losses']; $to+=$r['total_orders']; }
    sendResponse(true,'Range report',['summary'=>['start_date'=>$start,'end_date'=>$end,'total_orders'=>$to,'total_sales'=>$ts,'total_losses'=>$tl,'total_profit'=>floor($ts*0.30)],'daily_reports'=>$reports]);
}

function getProductStats($conn) {
    $top=[]; $r=$conn->query("SELECT p.id, p.name, SUM(oi.quantity) as total_sold, SUM(oi.quantity*oi.price) as revenue FROM order_items oi JOIN products p ON oi.product_id=p.id GROUP BY p.id ORDER BY total_sold DESC LIMIT 10");
    while($row=$r->fetch_assoc()) $top[]=$row;
    $low=[]; $r=$conn->query("SELECT id, name, stock FROM products WHERE stock < 10 ORDER BY stock ASC");
    while($row=$r->fetch_assoc()) $low[]=$row;
    $cats=[]; $r=$conn->query("SELECT category, COUNT(*) as count, AVG(price) as avg_price, SUM(stock) as total_stock FROM products GROUP BY category");
    while($row=$r->fetch_assoc()) $cats[]=$row;
    sendResponse(true,'Product stats',['top_products'=>$top,'low_stock'=>$low,'categories'=>$cats]);
}

function generateDailyReport($conn) {
    $today=$date=date('Y-m-d');
    $stmt=$conn->prepare("SELECT COUNT(*) as total_orders,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as co,COALESCE(SUM(CASE WHEN status='completed' THEN total_amount ELSE 0 END),0) as ts FROM orders WHERE DATE(created_at)=?");
    $stmt->bind_param('s',$today); $stmt->execute();
    $d=$stmt->get_result()->fetch_assoc(); $stmt->close();
    $profit=floor($d['ts']*0.30);
    $stmt=$conn->prepare("INSERT INTO admin_logs (date,total_sales,total_orders,total_profit) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE total_sales=?,total_orders=?,total_profit=?");
    $stmt->bind_param('siiiiii',$today,$d['ts'],$d['total_orders'],$profit,$d['ts'],$d['total_orders'],$profit);
    $stmt->execute() ? sendResponse(true,'Report generated',['date'=>$today,'total_sales'=>$d['ts'],'total_orders'=>$d['total_orders'],'profit'=>$profit]) : sendResponse(false,'Error: '.$conn->error);
    $stmt->close();
}
?>
