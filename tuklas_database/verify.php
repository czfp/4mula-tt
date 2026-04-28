<? 
// if it doesn't work, kindly transfer to login 

if (password_verify($password, $user['password'])) {

    echo json_encode([
        "status" => "success",
        "message" => "Login successful",
        "user_id" => $user['id']
    ]);

} else {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid password"
    ]);
}
?>