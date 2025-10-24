# Fix the route.ts file by replacing the broken corridor extraction code

$filePath = "C:\Users\ASUS\team-hack\app\api\ingest\route.ts"

# Read the entire file
$content = Get-Content $filePath -Raw

# Replace the problematic section
$oldCode = @"
        // Extract corridors from drops (blindspots/signal loss)
        const h3Res = parseInt(process.env.H3_RESOLUTION || '7');
        const dropCorridors = extractCorridors(drops, h3Res);

        // Extract corridors from normal consecutive GPS points (regular movement)
        const movementCorridors = extractCorridorsFromPoints(gpsFixes, h3Res);

        // Combine both types of corridors
        const allTraversals = [...dropCorridors, ...movementCorridors];

        console.log(``[INGEST] Trip $`{trip.id`}: $`{dropCorridors.length`} drop corridors + $`{movementCorridors.length`} movement corridors = $`{allTraversals.length`} total traversals``);

        // Batch process corridors: collect unique corridor keys first

        const uniqueKeys = new Map<string, typeof corridorKeys[0]>();

        for (const key of corridorKeys) {
          const keyStr = ``$`{key.aH3`}_$`{key.bH3`}_$`{key.direction`}``;
          if (!uniqueKeys.has(keyStr)) {
            uniqueKeys.set(keyStr, key);
          }
        }

        // Process all unique corridors (batch upsert to reduce DB calls)
        for (const [keyStr, corridorKey] of uniqueKeys) {
          await prisma.corridor.upsert({
            where: {
              aH3_bH3_direction: {
                aH3: corridorKey.aH3,
                bH3: corridorKey.bH3,
                direction: corridorKey.direction,
              },
            },
            create: {
              aH3: corridorKey.aH3,
              bH3: corridorKey.bH3,
              direction: corridorKey.direction,
            },
            update: {}, // No need to update if already exists
          });
        }

        // Now insert traversals (batch)
        for (const traversal of allTraversals) {
"@

$newCode = @"
        // Extract corridors from drops
        const h3Res = parseInt(process.env.H3_RESOLUTION || '7');
        const traversals = extractCorridors(drops, h3Res);
        
        console.log(``[INGEST] Trip $`{trip.id`}: $`{traversals.length`} corridors/traversals extracted``);
        
        for (const traversal of traversals) {
"@

$content = $content.Replace($oldCode, $newCode)

# Write back to file
$content | Set-Content $filePath -NoNewline

Write-Host "✅ File fixed successfully"
Write-Host "Verifying..."

# Verify the fix
$lines = Get-Content $filePath | Select-Object -Skip 197 -First 10
$lines | ForEach-Object { Write-Host $_ }
