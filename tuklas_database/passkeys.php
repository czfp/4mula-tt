<?php
include "db.php";

$user_id = $_POST['user_id'];
$credential_id = $_POST['credential_id'];
$public_key = $_POST['public_key'];
$sign_count = $_POST['sign_count'];

$sql = "INSERT INTO credentials (user_id, credential_id, public_key, sign_count)
        VALUES ('$user_id', '$credential_id', '$public_key', '$sign_count')";

if ($conn->query($sql)) {
    echo json_encode(["status" => "saved"]);
} else {
    echo json_encode(["status" => "error"]);
}
?>