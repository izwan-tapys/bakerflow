import os

dirs = ['src/app/dashboard', 'src/app/office', 'src/app/kitchen', 'src/app/delivery']

for d in dirs:
    if not os.path.exists(d):
        continue
    for dp, dn, filenames in os.walk(d):
        for f in filenames:
            if f.endswith('.tsx'):
                p = os.path.join(dp, f)
                with open(p, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                changed = False
                if 'bg-white/95' in content:
                    content = content.replace('bg-white/95', 'bg-background/95')
                    changed = True
                
                if 'bg-white' in content:
                    # Replace bg-white with bg-card for better dark mode handling
                    # We use a space before or check if it's the start of string to avoid accidental matches
                    content = content.replace(' bg-white ', ' bg-card ')
                    content = content.replace('"bg-white ', '"bg-card ')
                    content = content.replace(' bg-white"', ' bg-card"')
                    content = content.replace('\'bg-white ', '\'bg-card ')
                    content = content.replace(' bg-white\'', ' bg-card\'')
                    changed = True

                if changed:
                    print(f"Updating: {p}")
                    with open(p, 'w', encoding='utf-8') as file:
                        file.write(content)
