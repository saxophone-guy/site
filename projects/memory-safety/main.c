#include <stdio.h>
#include <stdlib.h>

void unsafeGenerateParenthesis(int n, int open, int close, char *current, int pos) {
    if (close == n) {
        printf("%s\n", current);
        return;
    }
    if (open < n) {
        current[pos] = '(';
        unsafeGenerateParenthesis(n, open + 1, close, current, pos + 1);
    }
    if (close < open) {
        current[pos] = ')';
        unsafeGenerateParenthesis(n, open, close + 1, current, pos + 1);
    }
}

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 1;

    char current[2 * n + 1];
    current[2 * n] = '\0';

    unsafeGenerateParenthesis(n, 0, 0, current, 0);

    return 0;
}

