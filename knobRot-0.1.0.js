(function( $ ) {

	var methods = {
		
		init: function( options ) {

			// Lets have some default settings
			var settings = $.extend({			
			
				// The default class - over-ride this for different knob styles
				classes: ['rot-knob'],
						
				// The number of frames in the knob image				
				frameCount: 64,
				
				// The dimensions of the source frame in PX				
				frameWidth: 64,
				frameHeight: 64,				
							
				// The value range				
				minimumValue: -100,
				maximumValue: 100,				
							
				// If detent is true, detentValue specifies the snap value				
				// detentThreshold specifies the value range either side that
				// will 'snap' to the detentValue
				detent: true,	
				detentValue: 0,
				detentThreshold: 10,
				
				// If the knob has a discrete number of steps, how many?
				// Discrete steps can be used for things like a switch you can drag
				// on or off, etc.				
				discreteSteps: false,
				stepCount: 2,
				
				// If dragVertical is false, horizontal dragging modifies the value				
				dragVertical: true,
				
				// Invert the direction of the change
				invertDirection: false,				
			
				// The speed at which the knob value changes when dragged 
				// Higher numbers equal faster drag speed				
				dragMultiplier: 1,							
			
				// The FPS of the knob animation
				animationFPS: 25,
				
				// Whether or not to hide the associated input element
				hideInput: false,
				
				// Whether or not to hide the real value field
				hideRealValue: true,				
				
				// If isToggle is true, rather than dragging to change the value
				// you simply click to toggle between max and min - all other settings
				// to do with detenting and steps will be ignored - step count will
				// be forced to true
				// Not yet implemented
				isToggle: true								
			
			}, options );

			return this.each(function() {
				
				// Perform a sanity check
				if ( settings.minimumValue >= settings.maximumValue ) {
				} else if ( settings.discreteSteps == true && settings.stepCount <= 1 ) {
					throw 'Knob range error: Maximum value must be greater than minimum value.';
					throw 'Invalid step count: Discrete knob must have a minimum of 2 steps.';
				} 					
				
				// Buffer the knob element
				var $this = $(this);				
				
				// knobRot currently only works with text inputs				
				if ($this.is('input:text')) {	
				
					// Create a second text field for real value processing
					var realValueField = $('<input>', {
						'type': 'text',
						'value': $this.val()
					});
					
					// Attach the real value field to the dom
					$this.after(realValueField);				
					
					//Set initial data values
					realValueField.data('knobRot', {
						'settings': settings,
						'outputField': $this
					});
					
					//Calculate some range offsets
					realValueField.data('knobRot').rangeSize = settings.maximumValue - settings.minimumValue;
					realValueField.data('knobRot').rangeOffset = 0 - settings.minimumValue;					
					
					//Determine the step increment amount					
					if ( settings.discreteSteps == true ) {					
						realValueField.data('knobRot').stepIncrement = (settings.maximumValue - settings.minimumValue) / ( settings.stepCount - 1 );
					}
					
					//Calculate the initial value
					realValueField.data('knobRot').calculatedValue = methods.calculateValue(realValueField);
					
					//Calculate the initial frame offset
					realValueField.data('knobRot').currentFrame = methods.calculateFrame(realValueField);	
					
					//Flag to indicate whether or not to refresh the knob value and graphics
					realValueField.data('knobRot').dirtyData = true;
					
					//Calculate the frame delay
					var updateDelay = 1000 / settings.animationFPS;								

					//Create knob graphic div - build the classes string too					
					settings.classes[settings.classes.length] = 'rot-knob-base';
					var forName = $this.attr('name');
					if (typeof(forName) == 'undefined') {
						forName = 'unnamed';
					}
					settings.classes[settings.classes.length] = 'for-input-' + forName + '-' + $this.attr('id');
					var knobDiv = $('<div>', { 
						'class': settings.classes.join(' ')
					});				
					
					//Link graphic div with input element
					knobDiv.data('knobRot', { target: realValueField });
					realValueField.data('knobRot').target = knobDiv;
					
					//Set the style of the grahic div to some sensible defaults
					knobDiv.css({
						'width': settings.frameWidth + 'px',
						'height': settings.frameHeight + 'px',
						'background-position-x': methods.calculateBackgroundOffsetX( realValueField ) + 'px',
						'background-repeat': 'no-repeat',
						'cursor': 'pointer'
					});
					
					//Bind drag events to the knob div
					knobDiv.on('mousedown.knobRot', function( event ){
						
						$knobDiv = $(this);

						// Make sure we're only dragging once
						if ( $('#rot-knob-drag').size() == 0 ) {
						
							var startOffset = {
								'left': event.pageX,
								'top': event.pageY
							};
						
							// Set the drag containers starting point
							var dragContainer = $('<div>', {
								'id': 'rot-knob-drag'
							});
							
							dragContainer.css({
								'left': startOffset.left + 'px',
								'top': startOffset.top + 'px',
								'position': 'absolute',
								'width': '1px',
								'height': '1px',
								'display': 'none',
								'cursor': 'pointer'
							});	
							
							// Bind the container to its knob and settings
							dragContainer.data('knobRot', {
								'lastOffset': startOffset,
								'target': $knobDiv
							});
							
							// Bind the knob to its drag container
							$knobDiv.data('knobRot').dragContainer = dragContainer;

							// Add drag class
							$knobDiv.addClass('dragging')							
							
							// Flag the drag
							$knobDiv.data('knobRot').dragging = true;							
							
							$('body').prepend(dragContainer);

						}
					});
					
					// Link the knob div to the input field					
					$this.data('knobRot', { knob: knobDiv });
					
					// Disable selection if a drag is in progress
					$(document).on('selectstart.knobRot select.knobRot',function(){			
						if ($('#rot-knob-drag').size() > 0) {
							return false;
						}
					});
										
					// Handle the mouse leaving the window
					$(document).on('mouseout.knobRot', function( event ) {
						if (event.toElement == null || event.fromElement == null) {
							methods.removeDragContainer();
						}
					});

					// Handle dragging
					$(document).on('mousemove.knobRot', function( event ) {
						//Attempt to select the drag container
						var dragContainer = $('#rot-knob-drag');

						if (dragContainer.size() > 0) {
						
							//Move the drag container
							dragContainer.css({
								'left': event.pageX,
								'top': event.pageY
							});
							
							//Calculate the distance moved
							var displacement = {
								'horizontal': event.pageX - dragContainer.data('knobRot').lastOffset.left,
								'vertical': event.pageY - dragContainer.data('knobRot').lastOffset.top
							}														
							
							//Update the drag container's last offser
							dragContainer.data('knobRot').lastOffset = {
								'left': event.pageX,
								'top': event.pageY
							}
							
							//Update the knob's field with the displaced value
							methods.updateValue( dragContainer.data('knobRot').target.data('knobRot').target, displacement);
							
							//Compare with current value to see if an event needs to be 
							//triggered			
							dragContainer.data('knobRot').target.data('knobRot').target.trigger('knobvaluechange');
						}																
					});					
					
					// Handle mouse up events
					$('body').on('mouseup.knobRot', function(){
						methods.removeDragContainer();
					});	
					
					// Handle direct changes to the field value
					realValueField.on('change', function() {
						realValueField.trigger('knobvaluechange');
					});
					
					// Handle knob value change events
					realValueField.on('knobvaluechange', function() {
						realValueField.data('knobRot').dirtyData = true;
						$this.val(realValueField.data('knobRot').calculatedValue);
					});
					
					//Insert the knob graphic div
					realValueField.after(knobDiv);
					
					//Register update callbacks
					setInterval( function() { methods.updateCallback(realValueField);	}, updateDelay );
					
					//Hide the input fields
					if (settings.hideInput == true) {
						$this.hide();
					}
					
					//Hide the input fields
					if (settings.hideRealValue == true) {
						realValueField.hide();					
					}										
					
					//Disable text entry
					$this.attr('disabled','disabled');
					$this.attr('unselectable','on');
					$this.on('mousedown', function() {return false;});
					$this.on('mouseover', function() {return false;});
				}				
			});
		}, 
		 /**
		  * Returns the calculated value of the knob
		  */
		 value: function() {
			$this = $(this);
			if ($this.is('input:text')) {
				if ($this.data('knobRot')) {
					return $this.data('knobRot').calculatedValue;
				} else {
					throw 'Can not call "value" on a non-knobRot element';
				}
			} else {
				throw 'Not a valid input element for knobRot getCalculatedValue';
			}
		 },	
		 /**
		  * Returns the current frame
		  */
		 frame: function() {
			$this = $(this);
			if ($this.is('input:text')) {
				if ($this.data('knobRot')) {
					return methods.calculateFrame($this);
				} else {
					throw 'Can not call "frame" on a non-knobRot element';
				}
			} else {
				throw 'Not a valid input element for knobRot getCalculatedValue';
			}
		 },				 
		/**
		 * Calculates the step of a knob (accounting for detent,
		 * ranges, steps, etc.)
		 * Only really makes sense if discreteSteps is true in the
		 * knob settings, throws an exception if this is not the case.
		 */
		calculateStep: function( $knob ) {
			var knobData = $knob.data('knobRot');
			var knobSettings = knobData.settings;
			
			if ( knobSettings.discreteSteps ) {				
				
				// Shift the value ranges to be positive numbers starting from 0
				var adjustedValue = parseFloat($knob.val()) + knobData.rangeOffset;

				// Calculate the fraction of the range the current value represents
				var rangeFraction = adjustedValue / knobData.rangeSize;

				// Calculate the step the range fraction represents			
				var calculatedStep = Math.round( rangeFraction * ( knobSettings.stepCount - 1) );

				// Win!
				return calculatedStep;
			
			} else {
				throw 'Unable to calculate discrete step offset for non-discrete knob.';
			}			
		},
		/**
		 * Calculates the value of a knob, taking step settings 
		 * and detenting into account
		 */
		 calculateValue: function( $knob ) {

			var knobData = $knob.data('knobRot');
			var knobSettings = knobData.settings;

			if ( knobSettings.discreteSteps == true ) {			
			
				// Work out the current step
				var currentStep = methods.calculateStep( $knob );

				// Caluclate the current value based on the increment value
				// and current step value
				var calculatedValue = currentStep * knobData.stepIncrement - knobData.rangeOffset;
				
			} else {
				var calculatedValue = parseFloat($knob.val());
			}
			
			// Determine if value is to be detented			
			if ( knobSettings.detent == true && calculatedValue >= knobSettings.detentValue - knobSettings.detentThreshold && calculatedValue <= knobSettings.detentValue + knobSettings.detentThreshold ) {
				calculatedValue = knobSettings.detentValue;
			}
								
			// Clamp value to minimum and maximum
			if ( calculatedValue < knobSettings.minimumValue ) {
			
				//Limit the input field's value
				$knob.val( knobSettings.minimumValue );
				return knobSettings.minimumValue;
			} else if ( calculatedValue > knobSettings.maximumValue ) {
			
				//Limit the input field's value
				$knob.val( knobSettings.maximumValue );
				return knobSettings.maximumValue;
			}
					
			return calculatedValue;
		 },
		 /**
		  * Calculates the current animation frame of the knob
		  */
		calculateFrame: function( $knob ) {
			
			var knobData = $knob.data('knobRot');
			var knobSettings = knobData.settings;			
			
			//Use the calculated value as it accounts for steps and
			//detenting, adjusted for range offset
			var calculatedValue = methods.calculateValue( $knob ) + knobData.rangeOffset;

			//Work out the fraction of the current value over the range
			var rangeFraction = calculatedValue / knobData.rangeSize;
			
			//Work out the frame
			var calculatedFrame = Math.round(rangeFraction * (knobSettings.frameCount - 1));

			//Clamp values
			if (calculatedFrame > (knobSettings.frameCount - 1)) {
				return (knobSettings.frameCount - 1);
			} else if (calculatedFrame < 0) {
				return 0;
			}
			
			return calculatedFrame;
			
		},
		/**
		 * Work out the background position
		 */
		calculateBackgroundOffsetX: function( $knob ) {
			var knobData = $knob.data('knobRot');
			var knobSettings = knobData.settings;	
			return 0 - methods.calculateFrame( $knob ) * knobSettings.frameWidth;
		},
		/**
		 * Animation callback
		 */
		updateCallback: function( $knob ) {
		
			// Refresh the knob graphics and values if required
			if ($knob.data('knobRot').dirtyData == true) {
				$knob.data('knobRot').dirtyData = false;
				$knob.data('knobRot').target.css('background-position-x',  methods.calculateBackgroundOffsetX( $knob ) + 'px');
				$knob.data('knobRot').calculatedValue = methods.calculateValue( $knob );
			}
		},
		/**
		 * For internal use only, removes the container used for dragging
		 * knobs
		 */
		removeDragContainer: function() {
			//Attempt to select the drag container
			var dragContainer = $('#rot-knob-drag');
			
			if (dragContainer.size() > 0) {
				
				//Traverse the drag container's data to find the
				//associated knob
				var assignedInput = dragContainer.data('knobRot').target;
				
				//Unflag the drag on the knob
				assignedInput.data('knobRot').dragging = false;
				
				//Detach the drag container from the knob
				assignedInput.data('knobRot').dragContainer = null;
				
				// Remove drag class
				assignedInput.removeClass('dragging');
				
				//Remove the drag container from the page
				$('#rot-knob-drag').remove();
			}
		},
		/**
		 * Updates a field's value given a top / left displacement
		 */
		 updateValue: function( $field, displacement) {
			var change = 0;
			
			// Switch between horizontal and vertical dragging depending on
			// defined settings
			if ($field.data('knobRot').settings.dragVertical) {
				change = displacement.vertical;
			} else {
				change = displacement.horizontal;
			}
			
			// Apply the multiplier
			change = change * $field.data('knobRot').settings.dragMultiplier;
			
			// Apply inversion if set (we sneakily flip the user's choice, as
			// most people see up as increasing value wheras in screen-space
			// up is a decrease in pixel position - same goes for left to right
			// readers.
			if (!$field.data('knobRot').settings.invertDirection) {
				change = 0 - change;
			}
			
			//Get the current field value
			var currentValue = parseFloat($field.val());		
			
			//Calculate the new value
			var newValue = currentValue + change;
			
			//Clamp the new value to the defined limits
			if (newValue > $field.data('knobRot').settings.maximumValue) {
				newValue = $field.data('knobRot').settings.maximumValue;
			} else if (newValue < $field.data('knobRot').settings.minimumValue) {
				newValue = $field.data('knobRot').settings.minimumValue;
			}
						
			//Set the new value
			$field.val(newValue);		
		 }
	};	
	/**
	 * Delegate method execution
	 */
	$.fn.knobRot = function( method ) {
		if ( methods[method] ) {
			return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.knobRot' );
		}    			
	};	
})( jQuery );
