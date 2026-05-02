function findPIPs(data, numPIPs) {
    if (data.length <= numPIPs) return data;
    
    // Initialize with first and last points
    let pips = [data[0], data[data.length - 1]];
    
    while (pips.length < numPIPs) {
        // Sort PIPs by time to maintain sequence
        pips.sort((a, b) => a.time - b.time);
        
        let maxDist = -1;
        let bestPoint = null;
        
        // Check between each pair of adjacent PIPs
        for (let i = 0; i < pips.length - 1; i++) {
            let p1 = pips[i];
            let p2 = pips[i + 1];
            
            // Find data points between p1 and p2
            let startIndex = data.findIndex(d => d.time === p1.time);
            let endIndex = data.findIndex(d => d.time === p2.time);
            
            for (let j = startIndex + 1; j < endIndex; j++) {
                let p3 = data[j];
                // Calculate vertical distance from p3 to line segment p1-p2
                // Line equation: y - y1 = m(x - x1)
                // y_line = p1.value + (p2.value - p1.value) * (p3.time - p1.time) / (p2.time - p1.time)
                let y_line = p1.value + (p2.value - p1.value) * (p3.time - p1.time) / (p2.time - p1.time);
                let dist = Math.abs(p3.value - y_line);
                
                if (dist > maxDist) {
                    maxDist = dist;
                    bestPoint = p3;
                }
            }
        }
        
        if (bestPoint) {
            pips.push(bestPoint);
        } else {
            break; // No more points can be added
        }
    }
    
    pips.sort((a, b) => a.time - b.time);
    return pips;
}

let data = [];
for(let i=0; i<10; i++) data.push({time: i, value: Math.sin(i)});
console.log(findPIPs(data, 4));
