import sys
import os

try:
    from PIL import Image
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "numpy"])
    from PIL import Image
    import numpy as np

img_path = r"C:\Users\SHERON\.gemini\antigravity\brain\f11f1655-dfa1-4b55-ac2d-d84e4d9b5cfd\media__1773235519695.png"
out_path = r"C:\Users\SHERON\Desktop\dumma\ExpenseTracker\logo.png"

print(f"Opening {img_path}")
img = Image.open(img_path).convert("RGBA")
data = np.array(img)

# Assume the top-left pixel represents the background color
bg_color = data[0, 0]
bg_r, bg_g, bg_b = bg_color[0], bg_color[1], bg_color[2]

# Allow a high tolerance because it might be a slight gradient
tolerance = 50

r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

mask = (abs(r.astype(int) - bg_r) < tolerance) & \
       (abs(g.astype(int) - bg_g) < tolerance) & \
       (abs(b.astype(int) - bg_b) < tolerance)

data[mask] = [0, 0, 0, 0]

# To avoid hard edges, we can do a very basic cleanup or just save it
img_transparent = Image.fromarray(data)

# Crop
bbox = img_transparent.getbbox()
if bbox:
    # Add a little padding
    padding = 10
    crop_box = (
        max(0, bbox[0] - padding),
        max(0, bbox[1] - padding),
        min(img.width, bbox[2] + padding),
        min(img.height, bbox[3] + padding)
    )
    img_cropped = img_transparent.crop(crop_box)
    img_cropped.save(out_path)
    print("Successfully processed and saved to", out_path)
else:
    print("Error: Could not determine bounding box. The image might be empty or threshold was too high.")
