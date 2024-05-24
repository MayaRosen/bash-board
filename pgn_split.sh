
if [ "$#" -ne 2 ]
then
echo "Usage: $0 <source_pgn_file> <destination_directory>"
exit 1
fi

source_path="$1"
input_file="capmemel24.pgn"
path_in_file="${source_path}/${input_file}"

if [ ! -f "$path_in_file" ]
then
echo "Error: File '$input_file' does not exist."
exit 1
fi

dest_dir="$2"

if [ ! -d "$dest_dir" ]
then
mkdir -p "$dest_dir"
echo "Created directory '$dest_dir'."
fi

csplit -s -z "$input_file" '/^\[Event /' '{*}'

count=1
for file in xx*; do
  mv "$file" "${dest_dir}/capmemel24_$count.pgn"
  ((count++))
done

echo "Games have been split into the directory '$dest_dir'."
