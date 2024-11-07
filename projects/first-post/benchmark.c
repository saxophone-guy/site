#include <stdio.h>
#include <stdint.h>
#include <time.h>

#ifdef __AVX2__
#include <immintrin.h>
#endif

#define N 10000000
#define MOD 1000000007

uint64_t sum_squares_mod(uint32_t n) {
    uint64_t sum = 0;
    for (uint32_t i = 0; i < n; i++) {
        sum = (sum + ((uint64_t)i * i) % MOD) % MOD;
    }
    return sum;
}

uint64_t sum_squares_mod_v2(uint32_t n) {
    uint64_t sum = 0;
    uint64_t batch_sum = 0;
    
    for (uint32_t i = 0; i < n; i++) {
        batch_sum += (uint64_t)i * i;
        if ((i & 1023) == 1023) {
            sum = (sum + batch_sum % MOD) % MOD;
            batch_sum = 0;
        }
    }
    sum = (sum + batch_sum % MOD) % MOD;
    return sum;
}

uint64_t sum_squares_mod_v3(uint32_t n) {
    uint64_t sum = 0;
    uint64_t square = 0;
    uint64_t increment = 1;
    uint64_t batch_sum = 0;
    
    for (uint32_t i = 0; i < n; i++) {
        batch_sum += square;
        square += increment;
        increment += 2;
        
        if ((i & 1023) == 1023) {
            sum = (sum + batch_sum % MOD) % MOD;
            batch_sum = 0;
        }
    }
    sum = (sum + batch_sum % MOD) % MOD;
    return sum;
}

uint64_t sum_squares_mod_v4(uint32_t n) {
    uint64_t sum = 0;
    
    #ifdef __AVX2__
    __m256i vsum = _mm256_setzero_si256();
    __m256i vincr = _mm256_set_epi64x(8, 6, 4, 2);
    __m256i vbase = _mm256_set_epi64x(28, 15, 6, 1);
    
    for (uint32_t i = 0; i < (n & ~3ULL); i += 4) {
        vsum = _mm256_add_epi64(vsum, vbase);
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

void benchmark(uint64_t (*func)(uint32_t), const char *name) {
    clock_t start = clock();
    uint64_t result = func(N);
    clock_t end = clock();
    double time_spent = (double)(end - start) / CLOCKS_PER_SEC * 1000;
    printf("%s: %llu - %fms\n", name, result, time_spent);
}

int main() {
    benchmark(sum_squares_mod, "Version 1: Naive implementation");
    benchmark(sum_squares_mod_v2, "Version 2: Batched modulo operations");
    benchmark(sum_squares_mod_v3, "Version 3: Square number properties");
    #ifdef __AVX2__
    benchmark(sum_squares_mod_v4, "Version 4: SIMD optimization");
    #else
    printf("Version 4: SIMD optimization not supported on this system.\n");
    #endif
    return 0;
}

