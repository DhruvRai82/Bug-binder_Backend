import subprocess

def get_large_objects():
    # Get all objects
    try:
        rev_list = subprocess.run(['git', 'rev-list', '--objects', '--all'], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        print(f"Error getting rev-list: {e}")
        return

    objects = []
    for line in rev_list.splitlines():
        parts = line.split(maxsplit=1)
        sha = parts[0]
        name = parts[1] if len(parts) > 1 else "no-name"
        objects.append((sha, name))
    
    print(f"Found {len(objects)} objects. Checking sizes...")

    # Batch check sizes
    # Input format: SHA
    input_str = '\n'.join([o[0] for o in objects])
    
    try:
        # batch-check output format: "%(objectname) %(objecttype) %(objectsize)"
        batch = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], 
                             input=input_str, capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        print(f"Error checking batch: {e}")
        return

    large_files = []
    size_map = {}
    
    for line in batch.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            sha = parts[0]
            size = int(parts[2])
            size_map[sha] = size
            if size > 50 * 1024 * 1024: # > 50MB
                large_files.append((sha, size))
    
    # Merge names
    final_list = []
    for sha, name in objects:
        if sha in size_map and size_map[sha] > 50 * 1024 * 1024:
            final_list.append((size_map[sha], sha, name))
            
    final_list.sort(key=lambda x: x[0], reverse=True)
    
    print("\nLarge files found (>50MB):")
    for size, sha, name in final_list:
        print(f"{size/1024/1024:.2f} MB - {sha} - {name}")

if __name__ == "__main__":
    get_large_objects()
