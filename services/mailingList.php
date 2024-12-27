<?php

// Create this at https://www.callmebot.com/blog/free-api-signal-send-messages/
// Turn off caller id from the phone app on your Android phone to hide your phone number
$secrets = file_get_contents("../secrets.txt");
[$phoneId, $apiKey, $notifyEmail] = preg_split("/\r\n|\n|\r/", $secrets);

$origin = '';
if (isset($_SERVER['HTTP_ORIGIN'])) {
	$origin = $_SERVER['HTTP_ORIGIN'];
}

$domain = apache_request_headers()['Host'];
if (0 === strpos($domain, 'services.')) {
	$domain = substr($domain, strlen('services.'));
}

header('Expires: Sun, 01 Jan 2014 00:00:00 GMT');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Allow from any origin
$supportLocalHostTesting = false;
if (($supportLocalHostTesting && $origin == 'http://localhost') || $origin == "https://$domain") {
	// Decide if the origin in $_SERVER['HTTP_ORIGIN'] is one
	// you want to allow, and if so:
	header("Access-Control-Allow-Origin: $origin");
	header("Vary: Origin");
	header('Access-Control-Allow-Credentials: true');
	header("AMP-Access-Control-Allow-Origin: $origin");
	header("Access-Control-Expose-Headers: AMP-Access-Control-Allow-Source-Origin");	
}

// Access-Control headers are received during OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
	if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
		// may also be using PUT, PATCH, HEAD etc
		header("Access-Control-Allow-Methods: GET, OPTIONS");
	}
	if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
		header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
	}
	exit(0);
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
	http_response_code(405);
	exit('I only support GET');
}

if (empty($_GET['email'])) {
	http_response_code(400);
	exit('email GET variable is required');
}
if ($_GET['location'] != '') {
	exit('Please use the contact form');
}

$name = trim($_GET['name']);
$name = preg_replace(['/\b"/','/"/',"/'/"], ['”','“',"’"], $name);

$email = trim($_GET['email']);
$email = filter_var($email, FILTER_VALIDATE_EMAIL);
if ($email === false) {
	http_response_code(400);
	exit('Invalid email');
}

if ($notifyEmail != '') {
	mail($notifyEmail, "Newsletter signup for $domain", trim("Add to mailing list: $email"), "From: <$email>" . "\r\n");
}

$text = <<< EOD
Domain: $domain
Email: $email

EOD;
$text = urlencode($text);

$url = "https://api.callmebot.com/signal/send.php?phone=$phoneId&apikey=$apiKey&text=$text";
file_get_contents($url);

header('Content-Type: application/json; charset=utf-8');
echo(json_encode(['success' => 'ok']));
?>