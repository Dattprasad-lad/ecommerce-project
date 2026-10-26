<?php
require_once __DIR__ . '/db.php';

$request_method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : null;

try {
    switch ($action) {
        case 'get_all':
            getProducts($conn);
            break;
        case 'get_by_category':
            getProductsByCategory($conn);
            break;
        case 'get_by_id':
            getProductById($conn);
            break;
        case 'search':
            searchProducts($conn);
            break;
        case 'add':
            if ($_SESSION['is_admin'] ?? false) {
                addProduct($conn);
            } else {
                sendResponse(false, 'Unauthorized');
            }
            break;
        case 'update':
            if ($_SESSION['is_admin'] ?? false) {
                updateProduct($conn);
            } else {
                sendResponse(false, 'Unauthorized');
            }
            break;
        case 'delete':
            if ($_SESSION['is_admin'] ?? false) {
                deleteProduct($conn);
            } else {
                sendResponse(false, 'Unauthorized');
            }
            break;
        default:
            getProducts($conn);
    }
} catch (Exception $e) {
    sendResponse(false, 'Error: ' . $e->getMessage());
}

function getProducts($conn) {
    $query = "SELECT id, name, category, price, original_price, rating, image, description, stock FROM products ORDER BY created_at DESC";
    $result = $conn->query($query);

    if (!$result) {
        sendResponse(false, 'Database error: ' . $conn->error);
        return;
    }

    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }

    sendResponse(true, 'Products fetched successfully', ['products' => $products]);
}

function getProductsByCategory($conn) {
    if (empty($_GET['category'])) {
        sendResponse(false, 'Category is required');
        return;
    }

    $category = $_GET['category'];
    $query = "SELECT id, name, category, price, original_price, rating, image, description, stock FROM products WHERE category = ? ORDER BY created_at DESC";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('s', $category);
    $stmt->execute();
    $result = $stmt->get_result();

    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }

    $stmt->close();
    sendResponse(true, 'Products fetched successfully', ['products' => $products]);
}

function getProductById($conn) {
    if (empty($_GET['id'])) {
        sendResponse(false, 'Product ID is required');
        return;
    }

    $id = intval($_GET['id']);
    $query = "SELECT id, name, category, price, original_price, rating, image, description, stock FROM products WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        sendResponse(false, 'Product not found');
        return;
    }

    $product = $result->fetch_assoc();
    $stmt->close();
    sendResponse(true, 'Product fetched successfully', ['product' => $product]);
}

function searchProducts($conn) {
    if (empty($_GET['query'])) {
        sendResponse(false, 'Search query is required');
        return;
    }

    $search_term = '%' . $_GET['query'] . '%';
    $query = "SELECT id, name, category, price, original_price, rating, image, description, stock FROM products 
              WHERE name LIKE ? OR category LIKE ? OR description LIKE ? 
              ORDER BY created_at DESC LIMIT 20";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('sss', $search_term, $search_term, $search_term);
    $stmt->execute();
    $result = $stmt->get_result();

    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }

    $stmt->close();
    sendResponse(true, 'Products fetched successfully', ['products' => $products]);
}

function addProduct($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['name']) || empty($input['category']) || empty($input['price'])) {
        sendResponse(false, 'Required fields: name, category, price');
        return;
    }

    $original_price = $input['original_price'] ?? $input['price'];
    $rating = $input['rating'] ?? 4.5;
    $description = $input['description'] ?? '';
    $stock = $input['stock'] ?? 100;

    $query = "INSERT INTO products (name, category, price, original_price, rating, description, stock) 
              VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($query);
    $stmt->bind_param('ssiiisi', $input['name'], $input['category'], $input['price'], $original_price, $rating, $description, $stock);

    if ($stmt->execute()) {
        $product_id = $conn->insert_id;
        $stmt->close();
        sendResponse(true, 'Product added successfully', ['product_id' => $product_id]);
    } else {
        $stmt->close();
        sendResponse(false, 'Error adding product: ' . $conn->error);
    }
}

function updateProduct($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['id'])) {
        sendResponse(false, 'Product ID is required');
        return;
    }

    $id = intval($input['id']);
    $name = $input['name'] ?? null;
    $category = $input['category'] ?? null;
    $price = isset($input['price']) ? intval($input['price']) : null;
    $original_price = isset($input['original_price']) ? intval($input['original_price']) : null;
    $rating = isset($input['rating']) ? floatval($input['rating']) : null;
    $description = $input['description'] ?? null;
    $stock = isset($input['stock']) ? intval($input['stock']) : null;

    $updates = [];
    $types = '';
    $values = [];

    if ($name !== null) { $updates[] = 'name = ?'; $types .= 's'; $values[] = $name; }
    if ($category !== null) { $updates[] = 'category = ?'; $types .= 's'; $values[] = $category; }
    if ($price !== null) { $updates[] = 'price = ?'; $types .= 'i'; $values[] = $price; }
    if ($original_price !== null) { $updates[] = 'original_price = ?'; $types .= 'i'; $values[] = $original_price; }
    if ($rating !== null) { $updates[] = 'rating = ?'; $types .= 'd'; $values[] = $rating; }
    if ($description !== null) { $updates[] = 'description = ?'; $types .= 's'; $values[] = $description; }
    if ($stock !== null) { $updates[] = 'stock = ?'; $types .= 'i'; $values[] = $stock; }

    if (empty($updates)) {
        sendResponse(false, 'No fields to update');
        return;
    }

    $query = 'UPDATE products SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $types .= 'i';
    $values[] = $id;

    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$values);

    if ($stmt->execute()) {
        $stmt->close();
        sendResponse(true, 'Product updated successfully');
    } else {
        $stmt->close();
        sendResponse(false, 'Error updating product: ' . $conn->error);
    }
}

function deleteProduct($conn) {
    if (empty($_GET['id'])) {
        sendResponse(false, 'Product ID is required');
        return;
    }

    $id = intval($_GET['id']);
    $query = 'DELETE FROM products WHERE id = ?';
    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $id);

    if ($stmt->execute()) {
        $stmt->close();
        sendResponse(true, 'Product deleted successfully');
    } else {
        $stmt->close();
        sendResponse(false, 'Error deleting product: ' . $conn->error);
    }
}

?>
