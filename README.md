### Skel2D

2D skeletal animation tool (WIP)

This is an experimental animation tool in which you define a skeleton and animations in a custom
format while getting a live preview of the end result rendered with webgl.

sample: http://urraka.github.io/skel2d/#1a8921e56c5b392e4180,sample

---

### Help

**Defining a skeleton**

Skeleton with 2 child bones called `bone1` and `bone2`:
```
skeleton
	bone1
	bone2
```

Skeleton with a child bone called `bone1`, which has a child bone called `bone2`:
```
skeleton
	bone1
	bone1.bone2
```

Same as the previous one:
```
skeleton
	bone1.bone2
```

As many levels as needed:
```
skeleton
	grandpa.parent.child.grandchild
```

Notes:
  - Indentation must be with tabs.
  - Only alphanumeric characters plus `-` and `_` are allowed for bone names.
  - A bone name can't start with a number.
  - A bone name can't be `skeleton`.

**Bone properties**

  - `l`: length
  - `r`: rotation
  - `x`: position-x
  - `y`: position-y
  - `i`: scale-x
  - `j`: scale-y

**Bone flags**

  - `flip-x`: flip on x axis
  - `flip-y`: flip on y axis
  - `no-rot`: don't inherit rotation from parents
  - `no-scale`: don't inherit scale from parents

**Setting bone properties/flags**

Bone with length=100 position=10,-10 scale=1.5x flipped on x axis and doesn't inherit rotation:
```
skeleton
	parent.bone l100 r45 x10 y-10 i1.5 j1.5 flip-x no-rot
```

Notes:
  - There can't be whitespace between a property and its value.
  - The properties belong to the child-most bone defined in the line (in the example above
  the properties apply to `bone`, `parent` is unaffected).
