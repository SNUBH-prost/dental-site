import struct, zlib, math

def make_png(size):
    w = h = size
    img = bytearray(w * h * 4)  # RGBA

    # Blue background #2563eb
    bg = (0x25, 0x63, 0xeb, 0xff)

    def set_px(x, y, r, g, b, a=255):
        if 0 <= x < w and 0 <= y < h:
            i = (y * w + x) * 4
            img[i:i+4] = [r, g, b, a]

    # Fill background
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 4
            img[i:i+4] = bg

    # Draw rounded rect background (rounded corners via circle test)
    r = size // 6  # corner radius
    for y in range(h):
        for x in range(w):
            in_corner = False
            # Check four corners
            for cx, cy in [(r, r), (w-1-r, r), (r, h-1-r), (w-1-r, h-1-r)]:
                if (x < r or x >= w-r) and (y < r or y >= h-r):
                    dist = math.sqrt((x-cx)**2 + (y-cy)**2)
                    if dist > r:
                        in_corner = True
                        break
            if in_corner:
                i = (y * w + x) * 4
                img[i:i+4] = [0, 0, 0, 0]  # transparent outside

    # Draw tooth shape (scaled to size)
    # Tooth is defined in a 100x100 unit space, centered
    def tooth_color(nx, ny):
        """Returns True if point (nx,ny) in [0,1]x[0,1] is inside tooth shape."""
        # Map to tooth coordinate space
        x = nx * 100
        y = ny * 100

        # Tooth occupies roughly x:20-80, y:15-90
        # Crown: x 20-80, y 15-55 (rounded top)
        # Root area: splits into two roots

        # Main crown
        crown_cx = 50
        crown_cy = 32
        crown_rx = 30
        crown_ry = 20

        # Check if in crown ellipse
        in_crown = ((x - crown_cx)**2 / (crown_rx**2) + (y - crown_cy)**2 / (crown_ry**2)) <= 1

        # Check rectangular crown body
        in_crown_body = (22 <= x <= 78) and (30 <= y <= 55)

        # Left root: ellipse centered at ~(37, 72)
        lrx, lry = 10, 18
        in_left_root = ((x - 37)**2 / lrx**2 + (y - 72)**2 / lry**2) <= 1

        # Right root: ellipse centered at ~(63, 72)
        in_right_root = ((x - 63)**2 / lrx**2 + (y - 72)**2 / lry**2) <= 1

        # Root connection
        in_root_conn = (28 <= x <= 72) and (50 <= y <= 60)

        return in_crown or in_crown_body or in_left_root or in_right_root or in_root_conn

    # Paint tooth white
    pad = size // 8
    tooth_w = size - 2 * pad
    tooth_h = size - 2 * pad

    for y in range(h):
        for x in range(w):
            # Check if background alpha is set (inside rounded rect)
            i = (y * w + x) * 4
            if img[i+3] == 0:
                continue
            nx = (x - pad) / tooth_w
            ny = (y - pad) / tooth_h
            if tooth_color(nx, ny):
                img[i:i+4] = [0xff, 0xff, 0xff, 0xff]

    # Encode PNG
    def write_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    rows = []
    for y in range(h):
        row = bytes([0])  # filter type None
        for x in range(w):
            i = (y * w + x) * 4
            row += bytes(img[i:i+4])
        rows.append(row)

    raw = b''.join(rows)
    compressed = zlib.compress(raw, 9)

    png = b'\x89PNG\r\n\x1a\n'
    png += write_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += write_chunk(b'IDAT', compressed)
    png += write_chunk(b'IEND', b'')
    return png

for size, name in [(192, 'icon-192'), (512, 'icon-512')]:
    data = make_png(size)
    with open(f'icons/{name}.png', 'wb') as f:
        f.write(data)
    print(f'Created icons/{name}.png ({len(data)} bytes)')
