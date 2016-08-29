<?php
    $dir = 'photos/';
    $file = $dir . basename($_FILES['webcam']['name']);
    $message = '';
    $data = array();

    if (move_uploaded_file($_FILES['webcam']['tmp_name'], $file)) {
        $code = 200;
        $message = 'Image uploaded successfully';
        $data['filename'] = $file;
        $data['location'] = $_POST['location'];
        $data['caption'] = $_POST['caption'];
    } else {
        $code = 401;
        $message = 'Could not upload image';
    }

    echo json_encode(
        array(
            'code' => $code,
            'message' => $message,
            'data' => $data
        )
    );


    // Todo: Create image

    // Todo: Add title
    // Todo: Add caption
    // Todo: Add exif data (location)
    // Todo: Store image
    // Todo: Return result (code: HTTP Code, text: Success, error, data: {path: toImage})