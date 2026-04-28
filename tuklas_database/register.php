<?php
include "db.php";

$username = $_POST['username'];

$sql = "INSERT INTO users (username) VALUES ('$username')";

if ($conn->query($sql)) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error"]);
}
?>