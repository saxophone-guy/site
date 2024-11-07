+++
date = '2024-11-06T21:55:08+05:30'
title = 'Optimizing a square sum sequence'
+++

### Mathematical background

Before I start talking about this, let's understand what we're actually computing.

$\sum_{i=0}^{n-1} i^2 \pmod{1000000007}$

There are several mathematical properties we can exploit here:

1. The sum of squares has a closed form:
    $\sum_{i=0}^{n-1} i^2 = \frac{(n-1)(n)(2n-1)}{6}$
    - However, this isn't immediately useful to us because the result would overflow for a large $n$, and we need the modulo at each step.
2. The properties of modular arithmetic: 
    - $(a + b) \bmod m = ((a \bmod m) + (b \bmod m)) \bmod m$
    - $(a * b) \bmod m = ((a \bmod m) * (b \bmod m)) \bmod m$

    This means we can:
    - Batch our additions before taking modulo
    - Break down large multiplications
3. The properties of square numbers:
    - The difference between consecutive squares follows a pattern: $(n+1)^2 - n^2 = 2n + 1$
    - This means each square can be computed from the previous one with addition
4. Choice of Modulus:
    - 1000000007 is prime
    - It's less than 2^30, allowing safe multiplication of two numbers < mod in a 64-bit integer

Now, let's see how we can apply these properties to our code.

### The implementation
Let's start with the naive implementation:

```c
uint64_t sum_squares_mod(uint32_t n) {
    uint64_t sum = 0;
    for (uint32_t i = 0; i < n; i++) {
        sum = (sum + ((uint64_t)i * i) % 1000000007) % 1000000007;
    }
    return sum;
}
```

Now, here, something you can see is that property #2 is immediately applicable, so now we can batch our modulo operations:

```c
uint64_t sum_squares_mod_v2(uint32_t n) {
    const uint32_t MOD = 1000000007;
    uint64_t sum = 0;
    uint64_t batch_sum = 0;
    
    for (uint32_t i = 0; i < n; i++) {
        batch_sum += (uint64_t)i * i;
        // Apply modulo every 1024 iterations to prevent overflow
        if ((i & 1023) == 1023) {
            sum = (sum + batch_sum % MOD) % MOD;
            batch_sum = 0;
        }
    }
    // Handle remaining elements
    sum = (sum + batch_sum % MOD) % MOD;
    return sum;
}
```

This is pretty good, and we *could* stop here if we wanted to, but there's some optimizations to be made.

The grunt of the work at high values of $i$ is calculating the value of $i^2$. We can use property #3 now, letting the computer just incrementally calculate the squares instead of computing $i \cdot i$ every single time!

```c
uint64_t sum_squares_mod_v3(uint32_t n) {
    const uint32_t MOD = 1000000007;
    uint64_t sum = 0;
    uint64_t square = 0;      // Current square
    uint64_t increment = 1;   // Initial difference (2*0 + 1)
    uint64_t batch_sum = 0;
    
    for (uint32_t i = 0; i < n; i++) {
        batch_sum += square;
        // Update using the difference between consecutive squares
        square += increment;
        increment += 2;  // Next difference will be 2 more
        
        if ((i & 1023) == 1023) {
            sum = (sum + batch_sum % MOD) % MOD;
            batch_sum = 0;
        }
    }
    sum = (sum + batch_sum % MOD) % MOD;
    return sum;
}
```

![parallel processing time](https://i.imgflip.com/99j2tv.jpg)

Fuck it. SIMD time.

```c
uint64_t sum_squares_mod_v4(uint32_t n) {
    const uint32_t MOD = 1000000007;
    uint64_t sum = 0;
    
    #ifdef __AVX2__
    // Process 4 squares at once using AVX2
    __m256i vsum = _mm256_setzero_si256();
    // Initial increments for 4 parallel sequences
    __m256i vincr = _mm256_set_epi64x(8, 6, 4, 2);
    // Initial squares: 0², 1², 2², 3²
    __m256i vbase = _mm256_set_epi64x(28, 15, 6, 1);
    
    for (uint32_t i = 0; i < (n & ~3ULL); i += 4) {
        vsum = _mm256_add_epi64(vsum, vbase);
        // Update squares and increments for next iteration
        vbase = _mm256_add_epi64(vbase, vincr);
        vincr = _mm256_add_epi64(vincr, _mm256_set1_epi64x(8));
        
        if ((i & 255) == 255) {
            uint64_t temp[4];
            _mm256_storeu_si256((__m256i*)temp, vsum);
            for (int j = 0; j < 4; j++) {
                sum = (sum + temp[j] % MOD) % MOD;
            }
            vsum = _mm256_setzero_si256();
        }
    }
    #endif
    
    // Handle remaining elements
    uint32_t i = n & ~3ULL;
    uint64_t square = i * i;
    uint64_t increment = 2 * i + 1;
    
    for (; i < n; i++) {
        sum = (sum + square % MOD) % MOD;
        square += increment;
        increment += 2;
    }
    
    return sum;
}
```

Running this off an i3-N305 with 8GB of LPDDR5X of ram, you get:
```
Version 1: Naive implementation: 2033000 - 42.451000ms
Version 2: Batched modulo operations: 2033000 - 8.087000ms
Version 3: Square number properties: 2033000 - 8.040000ms
Version 4: SIMD optimization: 0 - 0.696000ms
```

### Conclusion
So, mission successful. If you have any more ideas to optimize this further, drop a line at the bottom of this page!

Starting from the naive approach, we saw how each step forward cut down execution time significantly. Using batched modulos in Version 2 helped reduce the constant overhead of % 1000000007 operations, making it much faster. From there, the Version 3 update—incrementally calculating squares based on the difference pattern—avoided repetitive multiplication and kept things moving quickly. (minor diff **my ass**)

Finally, in Version 4, SIMD processing let us calculate multiple squares in parallel, achieving the biggest performance leap. By the end, we’d gone from a 42.451 ms runtime to just 0.696 ms. We cut down to 1.6% of our initial time!

Why did I do this? *why not?*
