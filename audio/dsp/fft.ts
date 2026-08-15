class Fft {
  private readonly reverse_indices: Uint32Array;
  private readonly cosine_table: Float32Array;
  private readonly sine_table: Float32Array;

  constructor(private readonly size: number) {
    const bit_count = Math.round(Math.log2(size));
    this.reverse_indices = new Uint32Array(size);
    for (let index = 0; index < size; index++) {
      let reversed = 0;
      for (let bit = 0; bit < bit_count; bit++) {
        reversed = (reversed << 1) | ((index >> bit) & 1);
      }
      this.reverse_indices[index] = reversed;
    }

    this.cosine_table = new Float32Array(size / 2);
    this.sine_table = new Float32Array(size / 2);
    for (let index = 0; index < size / 2; index++) {
      this.cosine_table[index] = Math.cos((-2 * Math.PI * index) / size);
      this.sine_table[index] = Math.sin((-2 * Math.PI * index) / size);
    }
  }

  transform(real: Float32Array, imaginary: Float32Array) {
    const size = this.size;
    for (let index = 0; index < size; index++) {
      const reversed = this.reverse_indices[index];
      if (reversed > index) {
        let temporary = real[index];
        real[index] = real[reversed];
        real[reversed] = temporary;
        temporary = imaginary[index];
        imaginary[index] = imaginary[reversed];
        imaginary[reversed] = temporary;
      }
    }

    for (let length = 2; length <= size; length <<= 1) {
      const half = length >> 1;
      const step = size / length;
      for (let offset = 0; offset < size; offset += length) {
        for (let index = 0; index < half; index++) {
          const table_index = index * step;
          const weight_real = this.cosine_table[table_index];
          const weight_imaginary = this.sine_table[table_index];
          const first = offset + index;
          const second = first + half;
          const transformed_real =
            real[second] * weight_real - imaginary[second] * weight_imaginary;
          const transformed_imaginary =
            real[second] * weight_imaginary + imaginary[second] * weight_real;
          real[second] = real[first] - transformed_real;
          imaginary[second] = imaginary[first] - transformed_imaginary;
          real[first] += transformed_real;
          imaginary[first] += transformed_imaginary;
        }
      }
    }
  }
}

export class RealFft {
  private readonly half: Fft;
  private readonly real: Float32Array;
  private readonly imaginary: Float32Array;
  private readonly cosine_table: Float32Array;
  private readonly sine_table: Float32Array;

  constructor(private readonly size: number) {
    this.half = new Fft(size / 2);
    this.real = new Float32Array(size / 2);
    this.imaginary = new Float32Array(size / 2);
    this.cosine_table = new Float32Array(size / 2);
    this.sine_table = new Float32Array(size / 2);
    for (let index = 0; index < size / 2; index++) {
      this.cosine_table[index] = Math.cos((-2 * Math.PI * index) / size);
      this.sine_table[index] = Math.sin((-2 * Math.PI * index) / size);
    }
  }

  magnitudes(input: Float32Array, output: Float32Array) {
    const half_size = this.size / 2;
    const real = this.real;
    const imaginary = this.imaginary;
    for (let index = 0; index < half_size; index++) {
      real[index] = input[2 * index];
      imaginary[index] = input[2 * index + 1];
    }

    this.half.transform(real, imaginary);
    output[0] = Math.abs(real[0] + imaginary[0]);
    output[half_size] = Math.abs(real[0] - imaginary[0]);
    for (let index = 1; index < half_size; index++) {
      const mirror = half_size - index;
      const even_real = (real[index] + real[mirror]) / 2;
      const even_imaginary = (imaginary[index] - imaginary[mirror]) / 2;
      const odd_real = (imaginary[index] + imaginary[mirror]) / 2;
      const odd_imaginary = (real[mirror] - real[index]) / 2;
      const weight_real = this.cosine_table[index];
      const weight_imaginary = this.sine_table[index];
      const result_real =
        even_real + weight_real * odd_real - weight_imaginary * odd_imaginary;
      const result_imaginary =
        even_imaginary + weight_real * odd_imaginary + weight_imaginary * odd_real;
      output[index] = Math.sqrt(
        result_real * result_real + result_imaginary * result_imaginary
      );
    }
  }
}
