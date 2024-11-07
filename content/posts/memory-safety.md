+++
date = '2024-11-07T17:01:43+05:30'
title = 'Achieving Memory Safety in C'
+++

### An Introduction

Let's talk about memory safety in C. If you've spent any time writing code in C, you've probably encountered bugs that don’t just crash your program—they can do all sorts of wonderful things, like turning your screen into a modern art display of random characters or, even worse, quietly corrupting your data.

I'm making this article to help some of you that are new to low-level programming understand it using a real-life scenario. I'm gonna be trying this out with [LeetCode's "Generate Parentheses" problem](https://leetcode.com/problems/generate-parentheses/description/?envType=problem-list-v3&envId=dynamic-programming).

### The *(Not-so)* Fun Fundamentals

Before we do get started though, let me explain some of this stuff. C is a powerful, low-level language. Unlike more modern languages, it doesn’t do much to hold your hand. You control memory, so you also have to manage it—release it, prevent overflows, and make sure you’re accessing only what you actually own.

### The Big Bad Bugs to Avoid

1. Reading or writing past the end of a buffer.
2. Allocating memory but forgetting to free it.
3. Pointers that refer to memory that’s already been freed.
4. Attempting to free memory that's already been freed.

### The Task at Hand

Given an integer `n`, we need to generate all possible valid combinations of n pairs of parentheses. So, for `n = 3`, our output should be:

```c
((()))
(()())
(())()
()(())
()()()
```

Seems simple enough, right? Just make sure you’ve got the right pairs and balance of parentheses, and we’re golden. But in C, memory safety while generating combinations can be tricky, especially since we'll need dynamic memory to store all possible strings and track where we’re at.

### Avoiding common pitfalls

- Dynamic Allocation: We’ll dynamically allocate memory to hold each combination, making sure not to overflow our buffer.
- Freeing Memory: As soon as we're done with memory, we’ll clean it up to avoid leaks.
- Access Boundaries: We'll use conditions to make sure we’re not going beyond what we allocated.

Just remembering these is usually enough to write memory safe code.

### Breaking down the solution

This is a problem that’s perfectly suited for recursion. We’ll build each valid string one character at a time by adding ( or ), as long as it maintains a valid balance.

In this first version, we’ll:
1. Write a function that recursively generates parentheses combinations.
2. Print each combination directly without storing it.

Since we’ll focus on getting the combinations, we’ll ignore memory allocation issues and assume our buffer size is always enough-**which is risky and unrealistic**. We'll point out the issues after this first step.

```c
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
```

Let's play a game: Find the issues!

There's two ways to play it: DIY, or use a stress tester. Usually, the DIY method is faster, but you can miss stuff. For this project, using a program is very, very overkill, and you can probably already find some mistakes in the above code, but for the sake of this post, I put this program through [AFL](https://en.wikipedia.org/wiki/American_Fuzzy_Lop_(software)) and [Valgrind](https://en.wikipedia.org/wiki/Valgrind). After a runtime of 1 hour of AFL (totally overkill for the simple program we made) for our code, we have 3 types of crashes for the following inputs:
1. 3333333333333@333333333333333333:

    This input caused a buffer overflow. It’s clear that the array current we’ve defined in the main() function is not large enough to handle strings that exceed the expected number of parentheses combinations. The buffer overflow happens when we try to store combinations longer than $2 * n$, which is a serious issue.
2. 3333333:

    This input led to a segmentation fault. This is likely caused by memory being accessed beyond what was allocated, possibly due to incorrect boundary checking. In the function unsafeGenerateParenthesis, we aren’t properly controlling the bounds of the current array, and trying to access current[pos] beyond its allocated size causes the crash.
3. -85:

    This one threw an invalid memory access error. Since n is expected to be a non-negative integer, passing a negative number doesn’t make sense for the problem. However, the code doesn't validate the input before starting the function, and this leads to strange behavior when trying to generate combinations of negative numbers of parentheses, triggering invalid memory reads or writes.

### Fixing the Issues

We’ve seen how easy it is for C code to go off the rails when we don’t pay attention to memory boundaries. But don’t worry—we’re going to fix these issues one by one.

**The Buffer Overflow**

To avoid a buffer overflow, we need to make sure the buffer we allocate is large enough to hold all combinations we generate. A simple fix here would be to dynamically allocate memory for the current array, ensuring that we can handle any number of parentheses combinations, no matter how large.

```c
#include <stdio.h>
#include <stdlib.h>

void safeGenerateParenthesis(int n, int open, int close, char *current, int pos) {
    if (close == n) {
        printf("%s\n", current);
        return;
    }
    if (open < n) {
        current[pos] = '(';
        safeGenerateParenthesis(n, open + 1, close, current, pos + 1);
    }
    if (close < open) {
        current[pos] = ')';
        safeGenerateParenthesis(n, open, close + 1, current, pos + 1);
    }
}

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) {
        printf("Invalid input\n");
        return 1;
    }

    char *current = (char *)malloc(2 * n + 1); // dynamically allocate space
    if (!current) {
        printf("Memory allocation failed\n");
        return 1;
    }
    
    current[2 * n] = '\0'; // null terminate

    safeGenerateParenthesis(n, 0, 0, current, 0);

    free(current); // free the allocated memory when done

    return 0;
}
```

Now we’re dynamically allocating current with enough space to store the combinations ($2 * n + 1$ bytes), and we also ensure to free the allocated memory at the end of the program. This solves the buffer overflow problem.

**The Segfault**

To fix the segmentation fault, we need to ensure we don't access out-of-bounds memory when manipulating the `current` array. In this case, we’re already dynamically allocating memory, so the array size is handled. However, we need to check that the position (`pos`) doesn’t exceed the size of the array during recursion.

Since we've already ensured the memory size is large enough, the segmentation fault was likely due to **not controlling the bounds in the recursive function properly**, especially if n was unexpectedly large. With dynamic memory, the bounds check becomes easier, but it's still essential to track the position carefully.

**Invalid Input Handling**
We saw that input like -85 broke the program. To prevent this, we should validate the input and reject invalid values for n.

In the modified code above, we added an input validation check to ensure that n is greater than 0. This prevents invalid or unexpected values from causing issues with memory allocation or logic.

Now here's the final, complete code for our project:
```c
#include <stdio.h>
#include <stdlib.h>

void safeGenerateParenthesis(int n, int open, int close, char *current, int pos) {
    if (close == n) {
        printf("%s\n", current);
        return;
    }
    if (open < n) {
        current[pos] = '(';
        safeGenerateParenthesis(n, open + 1, close, current, pos + 1);
    }
    if (close < open) {
        current[pos] = ')';
        safeGenerateParenthesis(n, open, close + 1, current, pos + 1);
    }
}

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n <= 0) {
        printf("Invalid input\n");
        return 1;
    }

    char *current = (char *)malloc(2 * n + 1); // dynamically allocate space
    if (!current) {
        printf("Memory allocation failed\n");
        return 1;
    }
    
    current[2 * n] = '\0'; // null terminate

    safeGenerateParenthesis(n, 0, 0, current, 0);

    free(current); // free the allocated memory when done

    return 0;
}
```

### Lessons learnt

- Use dynamic allocation wisely
- Input sanitation/validation
- Recursion can be tricky and needs careful boundary management
- Memory safety can go unnoticed sometimes

There's probably many others to be said, but these are the main points. Keep in mind that absolutely nothing is perfect, no matter how good it seems on the outside, including code. Leave a comment if you want to if you found any mistakes in my code, and thanks for reading the entirety of this post!
