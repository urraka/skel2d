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
  - color (format is `#RGB` or `#RRGGBB` optionally followed by an opacity value separated by a
  comma, i.e `#F00,0.5` or `#FF0000,0.5`)

**Bone flags**

  - `flip-x`: flip on x axis
  - `flip-y`: flip on y axis
  - `no-rot`: don't inherit rotation from parents
  - `no-scale`: don't inherit scale from parents

**Setting bone properties/flags**

A red bone with length=100 position=10,-10 scale=1.5x flipped on x axis and doesn't inherit rotation:

```
skeleton
	parent.bone #F00 l100 r45 x10 y-10 i1.5 j1.5 flip-x no-rot
```

Notes:
  - There can't be whitespace between a property and its value.
  - The properties belong to the child-most bone defined in the line (in the example above
  the properties apply to `bone`, `parent` is unaffected).

**Adding slots/attachments**

The concept of slots and attachments is taken from Spine. Basically, each bone can have slots and
each slot can have attachments (but only one active/visible one).

Currently, an attachment can be a sprite, a path or a shape.

This would define a bone with a slot named `slot` which has two attachments named `attachment1`
and `attachment2`. `attachment1` will be the default active attachment for `slot` because it's
the first one:

```
skeleton
	bone
		@slot[attachment1]
		@slot[attachment2]
```

Note: having multiple attachments in one slot is only useful when doing animations, where you can
switch a slot's active attachment.

If a bone has only one slot with one attachment it can be annoying to give them names, so by default
a slot will take the owner bone name and attachments will take the owner slot name. Example of how
this rule works:

```
skeleton
	parent.bone
		@               # slot named "bone" with attachment named "bone"
		@[attachment]   # slot named "bone" with attachment named "attachment"
		@slot           # slot named "slot" with attachment named "slot"
```

**Attachment types**

By default, an attachment will be of type `none` which isn't very useful. This is a list of
available attachment type keywords:

  - `:sprite`
  - `:rect`
  - `:circle`
  - `:ellipse`
  - `:path`

This would define a slot with a rectangle attachment:

```
skeleton
	bone
		@slot[attachment] :rect
```

**Attachment properties**

Attachment properties must be placed after the attachment type keyword.

All attachment types share the same transform properties as bones for defining position, scale
and rotation (`x`, `y`, `i`, `j`, `r`).

Shape and path attachments (that is, all of them except sprites) share some properties to define
the stroke and fill styles:

  - `t`: thickness for the stroke (default: `1`)
  - `m`: miter limit (default: `10`)
  - `f`: fill color (default: `#000`)
  - `s`: stroke color (default: `#000`)
  - `miter-join` or `bevel-join` or `round-join`: line join style (default `miter-join`)
  - `butt-cap` or `square-cap` or `round-cap`: line cap style (default: `butt-cap`)

The following are properties specific to some attachment types:

  - `w`: width (used by rects and ellipses, default: `0`)
  - `h`: height (used by rects and ellipses, default: `0`)
  - `d`: diameter for a circle or for rect corners (to make rounded rects, default: `0`)

Example: a 100x80 rect with a line width of 5, filled with blue, rotated 90 degrees and round line
joins:

```
skeleton
	bone
		@slot[attachment] :rect w100 h80 t5 f#00F r90 round-join
```

Sprites only have one additional property (apart from transform properties) which is a string with
the name of the image:

```
skeleton
	bone
		@slot[attachment] :sprite "image-name.png"
```

Note: strings are limited to no whitespace.

**Path attachments**

Paths are defined by the following commands:

  - `M <point>`: move-to (only supported as the first command, if ommited it will default to `0,0`)
  - `L <point>`: line-to
  - `Q <ctrl-point> <end-point>`: quadratic-curve-to
  - `B <ctrl-point1> <ctrl-point2> <end-point>`: bezier-curve-to
  - `: <bone>`: switch default bone binding
  - `C`: close-path

Each point given as a parameter to a command is bound to a bone to which it is relative to.
By default, that bone is the one that owns the attachment, but it can be any bone in the skeleton.
This allows paths to be changed by animating bones.

The format to define a point is `x,y:bone` (the `:bone` part is optional).
