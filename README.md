### Skel2D

2D skeletal animation tool (WIP)

http://urraka.github.io/skel2d/

This is an experimental animation tool in which you define a skeleton and animations in a custom
format while getting a live preview of the end result rendered with webgl.

sample: http://urraka.github.io/skel2d/#1a8921e56c5b392e4180,sample

---

### Documentation

#### Index

  - **Setting up the skeleton**
    - [Defining a skeleton hierarchy](#defining-a-skeleton-hierarchy)
    - [Bone properties](#bone-properties)
    - [Bone flags](#bone-flags)
    - [Setting bone properties/flags](#setting-bone-propertiesflags)
    - [Adding slots/attachments](#adding-slotsattachments)
    - [Attachment types](#attachment-types)
    - [Slot properties](#slot-properties)
    - [Attachment properties](#attachment-properties)
    - [Path attachments](#path-attachments)
  - **Animation**
    - [Defining a new animation](#defining-a-new-animation)
    - [Animation properties](#animation-properties)
    - [Animation timelines](#animation-timelines)
    - [Easing functions](#easing-functions)
  - **Skins**
    - [Defining skins](#defining-skins)
  - **Draw order**
    - [Defining the draw order](#defining-the-draw-order)

#### Defining a skeleton hierarchy

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

#### Bone properties

  - `l`: length
  - `r`: rotation
  - `x`: position-x
  - `y`: position-y
  - `i`: scale-x
  - `j`: scale-y
  - color (format is `#RGB` or `#RRGGBB` optionally followed by an opacity value separated by a
  comma, i.e `#F00,0.5` or `#FF0000,0.5`)

#### Bone flags

  - `flip-x`: flip on x axis
  - `flip-y`: flip on y axis
  - `no-rot`: don't inherit rotation from parents
  - `no-scale`: don't inherit scale from parents

#### Setting bone properties/flags

A red bone with `length=100`, `position=10,-10`, `scale=1.5x`, flipped on x axis which doesn't inherit
rotation:

```
skeleton
	parent.bone #F00 l100 r45 x10 y-10 i1.5 j1.5 flip-x no-rot
```

Notes:

  - There can't be whitespace between a property and its value.
  - The properties belong to the child-most bone defined in the line (in the example above
  the properties apply to `bone`, `parent` is unaffected).

#### Adding slots/attachments

The concept of slots and attachments is taken from Spine. Basically, each bone can have slots and
each slot can have attachments (but only one active/visible attachment).

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

#### Attachment types

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
		@ :rect
```

#### Slot properties

Slot properties must be placed **before** the attachment type keyword.

Currently, slots have only one property which is its color. Example:

```
skeleton
	bone
		@ #F00 :rect
```

The slot color will be multiplied with attachment colors. By default it's `#FFF` so it won't affect
the attachment. What makes the slot color different from whatever color the attachment has is that it
can be animated.

#### Attachment properties

Attachment properties must be placed **after** the attachment type keyword.

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
  - `d`: diameter for a circle or for rect corners (for making rounded rects, default: `0`)

Example: a 100x80 rect with a line width of 5, filled with blue, rotated 90 degrees and round line
joins:

```
skeleton
	bone
		@ :rect w100 h80 t5 f#00F r90 round-join
```

Sprites only have one additional property (apart from transform properties) which is a string with
the name of the image:

```
skeleton
	bone
		@ :sprite "image-name.png"
```

Note: currently, strings are limited to no whitespace.

#### Path attachments

Paths are defined by the following commands:

  - `M <point>`: move to (only supported as the first command, if ommited it will default to `0,0`)
  - `L <point>`: line to
  - `Q <ctrl-point> <end-point>`: quadratic curve to
  - `B <ctrl-point1> <ctrl-point2> <end-point>`: bezier curve to
  - `C`: close path
  - `: <bone>`: switch default bone binding (doesn't count as a command and can be used before `M`)

Each point given as a parameter to a command is bound to a bone to which it is relative to.
By default, that bone is the one that owns the attachment, but it can be any bone in the skeleton.
This allows paths to be changed by animating bones.

The format to define a point is `x,y` or `x,y:bone` to bind the point to a bone other than the default.

Simple path example, a red triangle with black outline:

```
skeleton
	bone
		@ :path f#F00
			M 0,0       # M could be ommited here because it's the default 0,0
			L 25,50
			L 50,0
			C
```

A bezier curve:

```
skeleton
	bone
		@ :path
			B 50,100 100,-100 150,0
```

Same bezier curve but with points bound to different bones:

```
skeleton
	bone
		@ :path
			B 0,0:cp1 0,0:cp2 0,0:end
	bone.cp1 x50 y100
	bone.cp2 x100 y-100
	end x150 y0
```

Using the default bone binding switch (this is the same red triangle as above but the top vertex can
be controled by `bone.child`):

```
skeleton
	bone x150
		@ :path f#F00
			M 0,0
			: child
			L 0,0
			: bone
			L 50,0
			C
	bone.child x25 y50
```

Notes:

  - When referencing a bone, it's enough to give the shortest unambiguous name for it. If the name
  of a bone that is a direct child of `skeleton` happened to be ambiguous, the `skeleton` keyword
  can be used as the parent bone to disambiguate. For example, if there are two bones `bone` and
  `bone.bone`, the former can be referenced as `skeleton.bone` and the latter as `bone.bone`.
  - Currently, path rendering is quite limited and filling will only work with simple covex shapes.

#### Defining a new animation

Animations are defined with the `anim` keyword. A name to identify it can be given with a string:

```
anim "name"
	# ...
```

Animations consist of timelines. There are bone and slot timelines. Each timeline is used to
animate a single *animatable* property from either a bone or a slot.

The following lists all the animatable bone and slot properties:

```
skeleton
	bone
		@slot

anim "name"
	bone
		r    # rotation
		x    # position-x
		y    # position-y
		i    # scale-x
		j    # scale-y
		s    # flip-x
		t    # flip-y
	@slot
		@    # current attachment
		r    # color (red component)
		g    # color (green component)
		b    # color (blue component)
		a    # color (alpha component)
		c    # color
```

Notes:

  - Slot names must have a leading `@`.
  - Bone and slot names can be the shortest unambiguous name that uniquely identifies them (same
  rule explained in [path attachments](#path-attachments) notes).
  - If a slot is given a color timeline (`c`), the individual color component timelines won't take
  effect.

#### Animation properties

An animation has the following properties:

  - `fps`: frames per second (default: `20`)
  - `frame`: defines the starting frame (default: `0`)
  - `step`: number of frames to advance on each step (default: `5`)
  - `easing`: function used for interpolation between frames (default: `li`)

These properties have a specific syntax to define them. Here's an example that would define the
default values:

```
anim "name" 20fps 0:5:li
	# ...
```

As shown above, `frame`, `step` and `easing` are defined together separated by a colon. It's not
necessary, however, to give a value to all of them. These are all valid ways of setting these
properties:

Syntax            | Description
:----------------:| ----------------------------------
`0:` or `0::`     | sets `frame`
`:5:` or `:5`     | sets `step`
`::li` or `:li`   | sets `easing`
`0:5:` or `0:5`   | sets `frame` and `step`
`0::li`           | sets `frame` and `easing`
`:5:li` or `5:li` | sets `step` and `easing`
`0:5:li`          | sets `frame`, `step` and `easing`

These properties (`frame`, `step` and `easing`) can be overriden on each animation item:

```
anim "name" 0:4
	bone :2:     # change step to 2
		# ...
```

#### Animation timelines

The purpose of timelines is to define a list of key frames for a given property. The syntax to
define them can be thought of as a list of commands. For example:

```
anim "name"
	bone
		x 0 -> 50 --> 0
```

The above can be read as:

  1. Add key frame with value `0`
  2. Advance one step (5 frames by default)
  3. Add key frame with value `50`
  4. Advance two steps (10 frames)
  5. Add key frame with value `0`

Most of the animatable properties take a numeric value, but there are some exceptions. Flip
timelines (`s` and `t`) take a boolean value (`true` or `false`). Attachment timelines (`@`)
take an attachment name from the list of attachments available for the slot that is
being animated. Finally, color timelines (`c`) take a color value with the same format described
in [bone properties](#bone-properties).

The following illustrates the syntax for the commands available:

```
-1.5      # add key frame with value -1.5 (numeric timelines)
+-1.5     # add key frame incrementing the previous key frame by -1.5 (numeric timelines)
*-1.5     # add key frame multiplying the previous key frame by -1.5 (numeric timelines)
true      # add key frame with value "true" (flip timelines)
false     # add key frame with value "false" (flip timelines)
name      # add key frame with value "name" (attachment timelines)
>         # advance 0 steps (noop)
->        # advance 1 step
---->     # advance 4 steps (number of hyphens defines the number of steps to advance)
0:5:li>   # set frame to 0, set step to 5, set easing to li and advance 0 steps
0:3:li->  # set frame to 0, set step to 3, set easing to li and advance 1 step (3 frames)
+1:>      # advance 1 *frame* (and 0 steps)
+1::li>   # advance 1 *frame*, set easing to li (and advance 0 steps)
{         # begin loop
}[2]      # end loop (loop 2 times)
```

Notes:

  - The syntax that sets `frame`, `step` and `easing` is identical to the one described in
  [animation properties](#animation-properties), except that it must be followed by
  "advance zero or more steps" (`>` preceded by zero or more `-`) and that it can set `frame`
  relatively by incrementing the current frame by `x` (`+x:>`).
  - Adding multiple key frames without advancing in time will result in only one key frame with the
  value of the last one.
  - Setting `frame` to go back in time won't work.
  - Setting the `step` value will take immediate effect, i.e. `:10:->` will advance `10` frames.
  It also takes effect on all the following commands (until changed again).
  - Setting `easing` will change the function used to interpolate the previous key frame with the
  next one, and it will also change the default easing function for all the following frames (until
  changed again).
  - Whitespace is important. All the commands illustrated must be separated by whitespace and there
  must not be any whitespace within a command (i.e. `{0 -> 1 -> 0}[2]` is invalid, must be
  `{ 0 -> 1 -> 0 }[2]`).
  - Color component timelines (`r`, `g`, `b` and `a`) take values between `0` and `1`. However,
  they are not restricted to it.

A more elaborate example:

```
skeleton
	bone l50
		@[red] :circle d30 t0 f#F00
		@[blue] :circle d30 t0 f#00F
		@line :path
			L 0,0:handle
	bone.handle

anim "test" 20fps
	bone 40:sio
		x 0 -> 200 -> 0
		y :10:> 0 :so-> 20 :li--> 20 :si-> 0 :so-> -20 :li--> -20 :si-> 0
		s false -> true -> false
		i :10:> 0.1 -> 1 --> 1 -> 0.1 -> 1 --> 1 -> 0.1
	handle :5:
		x { -15 :si-> 0 :so-> 15 :si-> 0 :so-> -15 }[4]
		y { 0 :so-> 15 :si-> 0 :so-> -15 :si-> 0 }[4]
	@bone :40:
		@ red -> blue -> red
```

See it in action: http://urraka.github.io/skel2d/#1a8921e56c5b392e4180,sample2

#### Easing functions

Easing functions change the way a key frame is interpolated with the next one for a smooth
transition. The default is a linear interpolation (`li`). Currently there are only a few functions
available:

Identifier | Description | Function
-----------|-------------|---------
`li`       | linear      | `y = x`
`si`       | sin-in      | `y = 1 - sin(pi/2 + x * pi/2);`
`so`       | sin-out     | `y = sin(x * pi/2)`
`sio`      | sin-in-out  | `y = 0.5 + sin(x * pi - pi/2) / 2`

These functions are used to convert a value `t` between `0` and `1` into a value `t'`. The result
is always used in a linear interpolation. So given two key frame values `a` and `b`, the function
used to interpolate them will be `a + (b - a) * t'` (or `a + (b - c) * f(t)` where `f` is the
easing function).

#### Defining skins

Skins are used to change the visuals of the skeleton by redefining its attachments.

Example:

```
skeleton
	bone
		@ :circle d10 f#F00
		@slot :rect w10 h10
		@other[small] :ellipse w20 h10
		@other[big] :ellipse w50 h20

skin "skin-name"
	@bone :circle d10 f#00F        # change to blue fill color
	@slot                          # remove (attachment of type none)
	@other[small] :ellipse w10 h5  # make it smaller
```

Notes:

  - The last attachment is left untouched so it will appear as defined in the skeleton.
  - All properties must be redefined when overriding an attachment, even if they don't change.

The naming rules are the same as described in [path attachments](#path-attachments) notes. The
following would have the same effect as the previous example:

```
skeleton
	bone
		@ :circle d10 f#F00
		@slot :rect w10 h10
		@other[small] :ellipse w20 h10
		@other[big] :ellipse w50 h20

skin "skin-name"
	@skeleton.bone.bone[bone] :circle d10 f#00F
	@skeleton.bone.slot[slot]
	@skeleton.bone.other[small] :ellipse w10 h5
```

#### Defining the draw order

By default, skeleton attachments are drawn in the order in which their owner slots are defined.
This can be changed by defining a draw order:

```
order
	@slot1
	@slot2
	# ...
```

It's simply a list of slots from the skeleton. The ones on top will be drawn first, so they will
appear in the back of following slots. Unlisted slots will be pushed at the end of the list in the
order they were defined in the skeleton.
