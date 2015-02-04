(function(exports) {

exports.ui = exports.ui || {};
exports.ui.Slider = Slider;

function Slider()
{
	var slider = document.createElement("div");
	var handle = document.createElement("div");
	var offset = 0;

	function calc_offset(e)
	{
		if (e.target === slider)
			return 0;

		var bounds = handle.getBoundingClientRect();
		return e.clientY - Math.floor(bounds.top + (bounds.bottom - bounds.top) * 0.5);
	}

	function on_change()
	{
		slider.dispatchEvent(new Event("change"));
	}

	function update(mousey)
	{
		var val = handle.style.top;
		var bounds = slider.getBoundingClientRect();
		var y = Math.max(bounds.top, Math.min(bounds.bottom, mousey - offset));

		handle.style.top = 100 * (y - bounds.top) / (bounds.bottom - bounds.top) + "%";

		if (handle.style.top !== val)
			on_change();
	}

	function on_mousemove(e)
	{
		update(e.clientY);
	}

	function on_mouseup()
	{
		slider.classList.remove("active");
		window.removeEventListener("mouseup", on_mouseup);
		window.removeEventListener("mousemove", on_mousemove);
	}

	function on_mousedown(e)
	{
		if (e.button !== 0)
			return;

		slider.classList.add("active");

		window.addEventListener("mouseup", on_mouseup);
		window.addEventListener("mousemove", on_mousemove);

		e.preventDefault();
		e.stopPropagation();

		offset = calc_offset(e);
		update(e.clientY);
	}

	slider.classList.add("ui-slider");
	slider.appendChild(handle);
	slider.addEventListener("mousedown", on_mousedown);

	Object.defineProperty(slider, 'value', {
		get: function() {
			return 1 - parseFloat(handle.style.top) / 100;
		},
		set: function(x) {
			var val = handle.style.top;
			handle.style.top = 100 * (1 - x) + "%";

			if (handle.style.top !== val)
				on_change();
		}
	});

	return slider;
}

}(this));
