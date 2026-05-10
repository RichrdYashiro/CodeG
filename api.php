<?php
session_start();
header('Content-Type: application/json');

// --- НАСТРОЙКИ БАЗЫ ДАННЫХ ---
$db_host = 'localhost';
$db_name = 'твое_имя_базы';
$db_user = 'твой_логин';
$db_pass = 'твой_пароль';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode(['error' => 'Connection failed: ' . $e->getMessage()]));
}

$action = $_GET['action'] ?? '';

// --- АВТОРИЗАЦИЯ ---

if ($action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $user = $data['username'] ?? '';
    $pass = $data['password'] ?? '';

    if (empty($user) || empty($pass)) {
        echo json_encode(['error' => 'Заполните все поля']);
        exit;
    }

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmt->execute([$user, $hash]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Пользователь уже существует']);
    }
}

elseif ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $user = $data['username'] ?? '';
    $pass = $data['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$user]);
    $found = $stmt->fetch();

    if ($found && password_verify($pass, $found['password_hash'])) {
        $_SESSION['user_id'] = $found['id'];
        $_SESSION['username'] = $found['username'];
        echo json_encode(['success' => true, 'username' => $found['username']]);
    } else {
        echo json_encode(['error' => 'Неверный логин или пароль']);
    }
}

elseif ($action === 'check_auth') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode(['logged_in' => true, 'username' => $_SESSION['username']]);
    } else {
        echo json_encode(['logged_in' => false]);
    }
}

elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);
}

// --- РАБОТА С КОДОМ (Только для авторизованных) ---

elseif ($action === 'save') {
    if (!isset($_SESSION['user_id'])) exit(json_encode(['error' => 'Auth required']));
    
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("INSERT INTO layout_history (html_code, css_code, schema_json, version_name, user_id) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $data['html'],
        $data['css'],
        $data['schema'],
        $data['name'] ?? date('H:i:s'),
        $_SESSION['user_id']
    ]);
    echo json_encode(['success' => true]);
}

elseif ($action === 'list') {
    if (!isset($_SESSION['user_id'])) exit(json_encode(['error' => 'Auth required']));

    $stmt = $pdo->prepare("SELECT id, timestamp, version_name, SUBSTRING(html_code, 1, 100) as preview FROM layout_history WHERE user_id = ? ORDER BY id DESC LIMIT 50");
    $stmt->execute([$_SESSION['user_id']]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

elseif ($action === 'get') {
    if (!isset($_SESSION['user_id'])) exit(json_encode(['error' => 'Auth required']));

    $id = $_GET['id'] ?? 0;
    $stmt = $pdo->prepare("SELECT * FROM layout_history WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $_SESSION['user_id']]);
    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
}
?>
