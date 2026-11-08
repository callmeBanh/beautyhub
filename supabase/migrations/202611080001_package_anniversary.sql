ALTER TABLE public.packages
  ADD CONSTRAINT packages_service_check
  CHECK (
    service IN (
      'Personal',
      'Profile/CV',
      'Graduation',
      'Couple',
      'anniversary',
      'Photoshoot makeup',
      'Party/Event'
    )
  ) NOT VALID;
